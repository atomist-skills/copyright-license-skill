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
	Category,
	parameter,
	ParameterType,
	ParameterVisibility,
	resourceProvider,
	skill,
} from "@atomist/skill";
import * as spdx from "spdx-license-list";
import { SkillConfiguration } from "./lib/configuration";
import { defaultFileGlob } from "./lib/header";

export const Skill = skill<SkillConfiguration & { repos: any }>({
	description:
		"Maintain repository license files and source code copyright headers",
	displayName: "Copyright License",
	categories: [Category.RepoManagement],
	iconUrl:
		"https://raw.githubusercontent.com/atomist-skills/copyright-license-skill/main/docs/images/icon.svg",

	resourceProviders: {
		github: resourceProvider.gitHub({ minRequired: 1 }),
	},

	parameters: {
		license: {
			type: ParameterType.SingleChoice,
			displayName: "License",
			description:
				"Select license to apply to repository and source code headers. " +
				"If no license is selected, the contents of the `LICENSE` file " +
				"in the repository will be scanned to determine the license.",
			options: Object.keys(spdx).map(id => ({
				text: spdx[id].name,
				value: id,
			})),
			required: false,
		},
		copyrightHolder: {
			type: ParameterType.String,
			displayName: "Copyright holder",
			description:
				"Entity holding the copyright on files, GitHub owner is used if not provided",
			placeHolder: "Your Company, Inc.",
			required: false,
		},
		fileGlobs: {
			type: ParameterType.StringArray,
			displayName: "Matching glob patterns",
			description:
				"Manage the copyright/license header in files matching the provided glob patterns. " +
				"If no glob patterns are provided, the skill matches all files it knows how to manage, " +
				`specifically, files matching the \`${defaultFileGlob}\` glob pattern.`,
			required: false,
		},
		ignoreGlobs: {
			type: ParameterType.StringArray,
			displayName: "Ignore glob patterns",
			description:
				"Glob patterns of files to not manage copyright/license header",
			required: false,
		},
		onlyChanged: {
			type: ParameterType.Boolean,
			defaultValue: true,
			displayName: "Consider only changed files",
			description:
				"Select if you want copyright license headers _added_ to only files changed in the push. " +
				"Copyright license headers are only ever _updated_ in changed files.",
			required: false,
		},
		blockComment: {
			type: ParameterType.Boolean,
			displayName: "Use block-style comments",
			description:
				"Use block-style comments (`/* … */`) for copyright license header if language supports it.",
			required: false,
		},
		commitMessage: {
			type: ParameterType.String,
			displayName: "Commit message",
			description:
				"Commit message to use when committing header fixes back into the repository",
			placeHolder: "Copyright license fixes",
			required: false,
			visibility: ParameterVisibility.Hidden,
		},
		push: parameter.pushStrategy({
			displayName: "Commit Strategy",
			description:
				"Select how to persist the changes made back to the repository",
		}),
		labels: {
			type: ParameterType.StringArray,
			displayName: "Pull request labels",
			description:
				"Additional labels to add to pull requests raised by this skill, e.g., to configure the " +
				"[auto-merge](https://go.atomist.com/catalog/skills/atomist/github-auto-merge-skill) behavior.",
			required: false,
		},
		repos: parameter.repoFilter(),
	},

	runtime: {
		memory: 512,
	},

	subscriptions: ["@atomist/skill/github/onPush"],
});
