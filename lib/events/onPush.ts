/*
 * Copyright © 2020 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
	EventHandler,
	github,
	repository,
	secret,
	status,
	subscription,
} from "@atomist/skill";
import * as fs from "fs-extra";
import { SkillConfiguration } from "../configuration";
import { fixCopyrightLicenseHeader } from "../header";
import { ensureLicense, findLicense, licenseMatcher } from "../license";

export const handler: EventHandler<
	subscription.types.OnPushSubscription,
	SkillConfiguration
> = async ctx => {
	const push = ctx.data.Push?.[0];
	if (!push) {
		return status.success("No push").hidden();
	}
	const branch = push.branch || "master";
	if (branch.startsWith("atomist/")) {
		return status.success(`Ignore generated branch ${branch}`).hidden();
	}
	const config = ctx.configuration;
	const repo = push.repo;
	if (!repo || !repo.owner || !repo.name) {
		return status.success("No repo").hidden();
	}
	const repoSlug = `${repo.owner}/${repo.name}`;
	if (!push.after) {
		return status
			.success(`No after commit in push of ${repoSlug}`)
			.hidden();
	}
	const sha = push.after?.sha;
	if (!sha) {
		return status.success(`No after SHA in push of ${repoSlug}`).hidden();
	}
	await ctx.audit.log(`Starting npm Version on ${repoSlug}#${sha}`);

	const credential = await ctx.credential.resolve(
		secret.gitHubAppToken({
			owner: repo.owner,
			repo: repo.name,
			apiUrl: repo.org?.provider?.apiUrl,
		}),
	);
	if (!credential) {
		return status
			.success(`Failed to get credential for ${repoSlug}`)
			.hidden();
	}
	const commits = push.commits?.length || 1;
	const project = await ctx.project.clone(
		repository.gitHub({
			branch,
			owner: repo.owner,
			repo: repo.name,
			credential,
			sha,
		}),
		{
			depth: commits + 1,
			detachHead: true,
		},
	);
	await ctx.audit.log(`Cloned repository ${repoSlug}#${sha}`);

	if (config.parameters.license) {
		try {
			await ensureLicense({
				cwd: project.path(),
				licenseKey: config.parameters.license,
			});
		} catch (e) {
			await ctx.audit.log(
				`Failed to ensure repository ${repoSlug} has license file: ${e.message}`,
			);
		}
	} else {
		const licenseFile = await findLicense(project.path());
		if (!licenseFile) {
			return status
				.success(`No license configured and no license file found`)
				.hidden();
		}
		let licenseContent: string;
		try {
			const licensePath = project.path(licenseFile);
			licenseContent = await fs.readFile(licensePath, "utf8");
		} catch (e) {
			return status.success(
				`No license configured and failed to read license file: ${e.message}`,
			);
		}
		const license = licenseMatcher({ license: licenseContent });
		if (!license) {
			return status.success(
				`No license configured and no license found matching ${licenseFile} file content`,
			);
		}
		config.parameters.license = license;
	}

	try {
		const warnings = await fixCopyrightLicenseHeader({
			...config.parameters,
			project,
			push: { commits, owner: repo.owner, sha },
		});
		for (const warning of warnings) {
			await ctx.audit.log(warning);
		}
	} catch (e) {
		const reason = `Failed to update copyright licence headers: ${e.message}`;
		await ctx.audit.log(reason);
		return status.failure(reason);
	}

	const title =
		config.parameters.commitMessage?.split("\n")?.[0] ||
		"Copyright license fixes";
	const body = config.parameters.commitMessage || title;
	const commitMessage =
		(config.parameters.commitMessage || title) +
		`\n\n[atomist:generated]\n[atomist-skill:atomist/copyright-license-skill]`;
	await github.persistChanges(
		ctx,
		project,
		config.parameters.push,
		{
			branch,
			defaultBranch: repo.defaultBranch || "master",
			author: {
				login: push.after?.author?.login || "atomist-bot",
				name: push.after?.author?.person?.name || "Atomist Bot",
				email:
					push.after?.author?.person?.emails?.[0]?.address ||
					"bot@atomist.com",
			},
		},
		{
			branch: `atomist/copyright-${branch}`,
			title,
			body,
			labels: config.parameters.labels,
		},
		{
			message: commitMessage,
		},
	);

	const msg = `Completed copyright license skill on ${repoSlug}`;
	await ctx.audit.log(msg);
	return status.success(msg);
};
