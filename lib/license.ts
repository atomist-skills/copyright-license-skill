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

import * as fg from "fast-glob";
import * as fs from "fs-extra";
import * as path from "path";
import * as spdx from "spdx-license-list/full";
import { findBestMatch } from "string-similarity";

/**
 * Find the first file in `cwd` that looks like a license file. Just
 * the name of the license file is returned.
 */
export async function findLicense(cwd: string): Promise<string | undefined> {
	const foundLicenses = await fg("license{,.*}", {
		caseSensitiveMatch: false,
		cwd,
		onlyFiles: true,
	});
	if (!foundLicenses || foundLicenses.length < 1) {
		return undefined;
	}
	return foundLicenses[0];
}

/** Arguments for [[licenseMatcher]] */
export interface LicenseMatcherArgs {
	/** Text of license */
	license: string;
	/** Licenses to search in spdx-license-list/full format */
	licenses?: string[];
}

/**
 * Return license identifier, if match is found. The matching done
 * uses the "string-similarity" package.
 */
export function licenseMatcher(args: LicenseMatcherArgs): string | undefined {
	if (!args.license || !args.license.trim()) {
		return undefined;
	}
	const licenseKeys = Object.keys(spdx);
	const targets = args.licenses
		? args.licenses
		: licenseKeys.map(id => spdx[id].licenseText);
	const bestMatch = findBestMatch(args.license, targets);
	if (bestMatch?.bestMatch?.rating > 0.99) {
		return licenseKeys[bestMatch.bestMatchIndex];
	}
	return undefined;
}

/** Arguments for [[ensureLicense]] */
export interface EnsureLicenseArgs {
	/** Directory to ensure has a license file */
	cwd: string;
	/** SPDX license ID */
	licenseKey: string;
}

/**
 * Ensure repository has proper license file. If a license file exists
 * and its contents match the contents of `args.license`, nothing is
 * done. If a license file exists and its contents do not match the
 * contents of `args.license`, the contents are updated. If a license
 * file does not exist, a file named `LICENSE` is created with the
 * appropriate contents.
 */
export async function ensureLicense(args: EnsureLicenseArgs): Promise<void> {
	if (!args.licenseKey) {
		return;
	}
	const licenseFile = await findLicense(args.cwd);
	const licensePath = path.join(args.cwd, licenseFile || "LICENSE");
	if (licenseFile) {
		const licenseContent = await fs.readFile(licensePath, "utf8");
		const licenseKey = licenseMatcher({ license: licenseContent });
		if (licenseKey === args.licenseKey) {
			return;
		}
	}
	await fs.writeFile(licensePath, spdx[args.licenseKey].licenseText);
}
