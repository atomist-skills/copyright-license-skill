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

import { log, project } from "@atomist/skill";
import * as fg from "fast-glob";
import * as fs from "fs-extra";
import * as micromatch from "micromatch";
import * as path from "path";
import * as spdx from "spdx-license-list/full";
import { SkillConfiguration } from "./configuration";
import { spdxLicenseHeaders } from "./licenseHeaders";
import { OnPushSubscription } from "./typings/types";

const commentTypes = [
	{
		prefix: "//",
		family: "C",
		extensions: [
			"c",
			"cc",
			"cpp",
			"cs",
			"cxx",
			"go",
			"h",
			"java",
			"js",
			"kt",
			"m",
			"php",
			"scala",
			"swift",
			"ts",
		],
	},
	{
		prefix: ";",
		family: "Lisp",
		extensions: ["cl", "clj", "cljs", "el", "lisp", "lsp", "scm"],
	},
	{
		prefix: "#",
		family: "Script",
		extensions: ["bash", "csh", "ksh", "pl", "py", "rb", "sh", "tcsh"],
	},
];

/** Arguments to [[fixCopyrightLicenseHeader]] */
export interface FixCopyrightLicenseHeaderArgs
	extends Pick<
		SkillConfiguration,
		| "copyrightHolder"
		| "fileGlob"
		| "ignoreGlobs"
		| "license"
		| "onlyChanged"
	> {
	project: project.Project;
	push: OnPushSubscription["Push"][0];
}

/**
 * Update copyright license header in configured files.
 */
export async function fixCopyrightLicenseHeader(
	args: FixCopyrightLicenseHeaderArgs,
): Promise<string[]> {
	const warnings: string[] = [];
	if (!args.license) {
		warnings.push("No license configured");
		return warnings;
	}

	const extensions = commentTypes
		.map(ct => ct.extensions)
		.reduce((pre, cur) => pre.concat(cur), []); // flatten
	const fileGlob = args.fileGlob || `**/*.@(${extensions.join("|")})`;

	let changed: string[];
	try {
		changed = await changedFiles(args);
	} catch (e) {
		warnings.push(`Failed to get list of changed files: ${e.message}`);
		changed = [];
	}
	let files: string[] | undefined;
	if (args.onlyChanged) {
		files = micromatch(changed, [fileGlob], { ignore: args.ignoreGlobs });
	} else {
		files = await fg(fileGlob, {
			cwd: args.project.path(),
			ignore: args.ignoreGlobs,
		});
	}
	if (!files || files.length < 1) {
		warnings.push(`No matching files found`);
		return warnings;
	}

	const header = licenseHeader({
		copyrightHolder: args.copyrightHolder,
		id: args.license,
	});
	for (const file of files) {
		try {
			const content = await fs.readFile(file, "utf8");
			const newContent = updateCopyrightHeader({
				content,
				file,
				header,
				updateYear: updateCopyrightYear({ ...args, changed, file }),
			});
			if (newContent !== content) {
				await fs.writeFile(file, newContent);
			}
		} catch (e) {
			warnings.push(`Failed to process '${file}': ${e.message}`);
		}
	}

	return warnings;
}

/** Arguments to [[updateYear]]. */
interface UpdateCopyrightYearArgs {
	/** Array of files changed in this push */
	changed: string[];
	/** File name to consider */
	file: string;
	/** If true, [[file]] can be assumed to be in [[changed]] */
	onlyChanged?: boolean;
}

/**
 * If `args.onlyChanged` is true, any `args.file` passed into this
 * function will also be in `args.changed`. That is, when
 * `args.onlyChanged` is true, only changed files are processed. Thus,
 * since the file is changed, the copyright year should be updated. If
 * `args.onlyChanged` is false, then the copyright year should only be
 * updated if `args.file` is in the `args.changed`.
 */
function updateCopyrightYear(args: UpdateCopyrightYearArgs): boolean {
	return args.onlyChanged || args.changed.includes(args.file);
}

/** Arguments to [[changedFiles]] */
interface ChangedFilesArgs {
	project: project.Project;
	push: OnPushSubscription["Push"][0];
}

/** Return array of files changed in push */
async function changedFiles(args: ChangedFilesArgs): Promise<string[]> {
	const sha = args.push.after.sha;
	const commits = args.push.commits.length || 1;
	const diffResult = await args.project.exec("git", [
		"diff",
		"--name-only",
		`${sha}~${commits}`,
	]);
	const files = diffResult.stdout.split("\n").filter(f => !!f);
	return files;
}

/** Arguments to [[licenseHeader]] */
export interface LicenseHeaderArgs {
	/** Legal entity holding copyright on files */
	copyrightHolder: string;
	/** SPDX license identifier */
	id: string;
}

/**
 * Provide usage instructions for license. Extract them from the
 * license if possible, otherwise provide a [[defaultUsage]].
 */
export function licenseHeader(args: LicenseHeaderArgs): string {
	const licenseInfo = spdx[args.id];
	if (!licenseInfo) {
		throw new Error(`Unknown license id: ${args.id}`);
	}
	if (spdxLicenseHeaders[args.id]) {
		return spdxLicenseHeaders[args.id]
			.replace("%YEAR%", year())
			.replace("%COPYRIGHT_HOLDER%", args.copyrightHolder);
	} else {
		return defaultHeader({
			copyrightHolder: args.copyrightHolder,
			licenseName: licenseInfo.name,
		});
	}
}

/** Arguments to [[defaultHeader]] */
export interface DefaultHeaderArgs {
	/** Legal entity holding copyright on files */
	copyrightHolder: string;
	/** SPDX license name */
	licenseName: string;
}

/** Default license header */
function defaultHeader(args: DefaultHeaderArgs): string {
	const license = /license$/i.test(args.licenseName)
		? args.licenseName
		: `${args.licenseName} License`;
	return `Copyright © ${year()} ${args.copyrightHolder}

Licensed under the ${license};
you may not use this file except in compliance with the License.`;
}

/** Return current year as string */
function year(): string {
	return new Date().getFullYear().toString(10);
}

const newline = "(?:\n|\r|\r\n|\u2028|\u2029)";
const horizontalSpace = "[^\\S\n\r\u2028\u2029]";

function lineComment(prefix: string): string {
	return `${horizontalSpace}*${prefix}.*${newline}`;
}

/**
 * Regular expression for matching copyright header in source code
 * files. The regular expression contains the following capture
 * groups.
 *
 * 1. Copyright year from line-style comment headers
 * 2. Copyright year from block-style comment headers (only if prefix === "//")
 */
export function copyrightHeaderRegExp(prefix: string): RegExp {
	const copyright = "\\bCopyright\\b.*\\b(\\d{4,})\\b";
	const lc = lineComment(prefix);
	const lineHeader = `${horizontalSpace}*${prefix}.*${copyright}.*${newline}(?:${lc})*`;
	if (prefix === "//") {
		const blockHeader = `${horizontalSpace}*/\\*[\\S\\s]*?${copyright}[\\S\\s]*?\\*/`;
		return new RegExp(`(?:${lineHeader}|${blockHeader})`, "i");
	} else {
		return new RegExp(lineHeader, "i");
	}
}

/**
 * Regular expression for matching preamble content in source code
 * files. The preamble includes any shebang line and file description
 * comment.
 */
export function preambleRegExp(prefix: string): RegExp {
	const shebang = `#!.*${newline}`;
	const lineComments = `(?:${lineComment(prefix)})+`;
	const blockComment = `${horizontalSpace}*/\\*[\\S\\s]*?\\*/`;
	if (prefix === "//") {
		return new RegExp(`^(?:${lineComments}|${blockComment})`);
	} else {
		return new RegExp(`^(?:${shebang})?${lineComments}`);
	}
}

/** Return `true` if content has a license header. */
/* function hasHeader(content: string): boolean {
	return headerRegExp().test(content);
} */

/** Arguments to [[prefixHeader]]. */
export interface PrefixHeaderArgs {
	/** Desired header */
	header: string;
	/** Comment prefix */
	prefix: string;
}

/** Prepend each line of comment header with comment prefix. */
export function prefixHeader(args: PrefixHeaderArgs): string {
	if (!args.header) {
		return args.header;
	}
	return (
		args.header
			.split("\n")
			.map(l => `${args.prefix} ${l}`.trimEnd())
			.join("\n") + "\n"
	);
}

/** Arguments to [[updateCopyrightHeader]]. */
export interface UpdateCopyrightHeaderArgs
	extends Pick<PrefixHeaderArgs, "header"> {
	/** Current file content. */
	content: string;
	/** File name */
	file: string;
	/**
	 * If true, update copyright date in file, otherwise only add
	 * copyright header if file does not have one.
	 */
	updateYear: boolean;
}

/**
 * Update header content, if necessary.
 */
export function updateCopyrightHeader(args: UpdateCopyrightHeaderArgs): string {
	const ext = path.extname(args.file).replace(/^\./, "");
	const commentType = commentTypes.find(ct => ct.extensions.includes(ext));
	if (!commentType) {
		log.warn(
			`Glob matched file but extension matched no comment type: ${args.file}`,
		);
		return args.content;
	}

	const chRegExp = copyrightHeaderRegExp(commentType.prefix);
	const header = prefixHeader({ ...args, prefix: commentType.prefix });
	if (!header) {
		log.warn(
			`Glob matched file but extension matched no prefix: ${args.file}`,
		);
		return args.content;
	}
	const copyrightMatch = chRegExp.exec(args.content);
	if (copyrightMatch) {
		const copyrightYear = copyrightMatch.slice(1).find(y => !!y);
		const currentYear = year();
		if (copyrightYear === currentYear || !args.updateYear) {
			return args.content;
		}
		return args.content.replace(chRegExp, header);
	} else {
		const preambleMatch = preambleRegExp(commentType.prefix).exec(
			args.content,
		);
		if (preambleMatch) {
			const cut = preambleMatch[0].length;
			return (
				args.content.substring(0, cut) +
				header +
				args.content.substring(cut)
			);
		} else {
			return header + args.content;
		}
	}
}
