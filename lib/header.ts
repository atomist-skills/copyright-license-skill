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

/** Supported comment types and their file extensions. */
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
		extensions: ["cl", "clj", "cljs", "edn", "el", "lisp", "lsp", "scm"],
	},
	{
		prefix: "#",
		family: "Script",
		extensions: [
			"bash",
			"csh",
			"ksh",
			"pl",
			"py",
			"rb",
			"sh",
			"tcsh",
			"yaml",
			"yml",
		],
	},
];

/** All supported file extensions. */
const commentExtensions = commentTypes
	.map(ct => ct.extensions)
	.reduce((pre, cur) => pre.concat(cur), []); // flatten

/** Glob pattern of all supported file extensions. */
export const defaultFileGlob = `**/*.@(${commentExtensions.join("|")})`;

/** Arguments to [[fixCopyrightLicenseHeader]] */
export type FixCopyrightLicenseHeaderArgs = ChangedFilesArgs &
	Pick<
		SkillConfiguration,
		| "blockComment"
		| "copyrightHolder"
		| "fileGlobs"
		| "ignoreGlobs"
		| "license"
		| "onlyChanged"
	>;

/**
 * Update copyright license header in configured files.
 */
export async function fixCopyrightLicenseHeader(
	args: FixCopyrightLicenseHeaderArgs,
): Promise<string[]> {
	const logs: string[] = [];
	if (!args.license) {
		logs.push("No license configured");
		return logs;
	}
	const copyrightHolder = args.copyrightHolder || args.push.owner;

	const fileGlobs = args.fileGlobs || [defaultFileGlob];

	let changed: string[];
	try {
		changed = await changedFiles(args);
	} catch (e) {
		logs.push(`Failed to get list of changed files: ${e.message}`);
		changed = [];
	}
	const onlyChanged = args.onlyChanged || false;
	let files: string[] | undefined;
	if (onlyChanged) {
		files = micromatch(changed, fileGlobs, { ignore: args.ignoreGlobs });
	} else {
		files = await fg(fileGlobs, {
			cwd: args.project.path(),
			ignore: args.ignoreGlobs,
		});
	}
	if (!files || files.length < 1) {
		logs.push(`No matching files found`);
		return logs;
	}
	logs.push(`Matched ${files.length} files`);

	const header = licenseHeader({
		copyrightHolder,
		id: args.license,
	});
	const blockComment = args.blockComment || false;
	for (const file of files) {
		try {
			const filePath = args.project.path(file);
			const content = await fs.readFile(filePath, "utf8");
			const newContent = updateCopyrightHeader({
				blockComment,
				content,
				file,
				header,
				updateYear: updateCopyrightYear({ changed, file, onlyChanged }),
			});
			if (newContent !== content) {
				await fs.writeFile(filePath, newContent);
			}
		} catch (e) {
			logs.push(`Failed to process '${file}': ${e.message}`);
		}
	}

	return logs;
}

/** Arguments to [[updateYear]]. */
interface UpdateCopyrightYearArgs {
	/** Array of files changed in this push */
	changed: string[];
	/** File name to consider */
	file: string;
	/** If true, [[file]] can be assumed to be in [[changed]] */
	onlyChanged: boolean;
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
	push: {
		commits: number;
		owner: string;
		sha: string;
	};
}

/** Return array of files changed in push */
async function changedFiles(args: ChangedFilesArgs): Promise<string[]> {
	const sha = args.push.sha;
	const commits = args.push.commits;
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
export const horizontalSpace = "[^\\S\n\r\u2028\u2029]";

/**
 * Return regular expression syntax for line comment with provided
 * comment `prefix` token.
 */
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
		const blockHeader = `${horizontalSpace}*/\\*[\\S\\s]*?${copyright}[\\S\\s]*?\\*/${horizontalSpace}*${newline}?`;
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
	/**
	 * If true, use block-style comment for header if language
	 * supports it.
	 */
	blockComment: boolean;
	/** Desired header */
	header: string;
	/** Comment prefix */
	prefix: string;
}

/** Return true if blockComment is true and prefix is "//". */
function useBlockComment(
	args: Pick<PrefixHeaderArgs, "prefix" | "blockComment">,
): boolean {
	return args.blockComment && args.prefix === "//";
}

/** Prepend each line of comment header with comment prefix. */
export function prefixHeader(args: PrefixHeaderArgs): string {
	if (!args.header) {
		return args.header;
	}
	const blockComment = useBlockComment(args);
	let prefix = args.prefix;
	if (prefix === ";") {
		prefix = ";;";
	} else if (blockComment) {
		prefix = " *";
	}
	const headerLines = args.header.split("\n");
	const prefixedLines = headerLines.map(l => `${prefix} ${l}`.trimEnd());
	if (blockComment) {
		prefixedLines.unshift("/*");
		prefixedLines.push(" */");
	}
	return prefixedLines.join("\n") + "\n";
}

/** Arguments to [[updateCopyrightHeader]]. */
export interface UpdateCopyrightHeaderArgs
	extends Pick<PrefixHeaderArgs, "header" | "blockComment"> {
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
			const before = args.content.substring(0, cut);
			const start = before.endsWith("*/") ? `${before}\n` : before;
			const after = args.content.substring(cut).trimStart();
			const end = /\S/.test(after) ? `\n${after}` : "";
			return start + header + end;
		} else if (!args.content.trim()) {
			return header;
		} else {
			return header + "\n" + args.content.trimStart();
		}
	}
}
