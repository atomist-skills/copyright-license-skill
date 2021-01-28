/*
 * Copyright © 2021 Atomist, Inc.
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

import { horizontalSpace } from "./header";

/** Arguments to [[fmt]]. */
export interface FmtArgs {
	/** Text to format. */
	text: string;
	/** Target width, default 72. */
	target?: number;
}

/**
 * Format string to version having lines of target width. Lines may be
 * shorter or longer. It only trims lines of length greather than target.
 */
export function fmt(args: FmtArgs): string {
	const target = args.target || 72;
	const spaceRegExp = /\s/;
	const prefixRegExp = new RegExp(
		`^${horizontalSpace}+(?:(?:(?:\\d+|[A-Z]+|[a-z]+)\\.|\\((?:\\d+|[A-Z]+|[a-z]+)\\))${horizontalSpace}*)?`,
	);
	const paragraphs = args.text
		.split("\n\n")
		.map(p => p.trimEnd())
		.filter(p => !!p)
		.map(p => {
			const prefix = prefixRegExp.exec(p);
			const prefixLength = prefix ? prefix[0].length : 0;
			const beforeLines = p.split("\n");
			const lines: string[] = [];
			for (const beforeLine of beforeLines) {
				let current = beforeLine;
				let currentTarget = target;
				while (current.length > currentTarget) {
					if (lines.length > 0) {
						currentTarget = target - prefixLength;
					}
					let long: number | undefined;
					for (let i = currentTarget; i < current.length; i++) {
						if (spaceRegExp.test(current.charAt(i))) {
							long = i;
							break;
						}
					}
					if (long === undefined) {
						long = current.length;
					}
					let short: number | undefined;
					for (let i = currentTarget; i >= 0; i--) {
						if (spaceRegExp.test(current.charAt(i))) {
							short = i;
							break;
						}
					}
					if (long === 0 || short === undefined) {
						const [l, rest] = splitString(current, currentTarget);
						lines.push(l);
						current = rest;
						continue;
					} else {
						const longFactor = 2;
						const longPenalty = (long - currentTarget) * longFactor;
						const shortFactor = 1;
						const shortPenalty =
							(currentTarget - short) * shortFactor;
						const splitAt =
							longPenalty < shortPenalty ? long : short;
						const [l, rest] = splitString(current, splitAt);
						lines.push(l);
						current = rest;
					}
				}
				if (current) {
					lines.push(current);
				}
			}
			return lines.join(`\n${" ".repeat(prefixLength)}`);
		});
	return paragraphs.join("\n\n");
}

/**
 * Split a string prior to index `l` and return the resulting two
 * strings.
 */
function splitString(s: string, l: number): [string, string] {
	return [s.substring(0, l).trimEnd(), s.substring(l).trimStart()];
}
