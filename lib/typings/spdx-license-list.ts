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

declare module "spdx-license-list/simple" {
	const SpdxLicenseListSimple: Readonly<Set<string>>;
	export = SpdxLicenseListSimple;
}

declare module "spdx-license-list" {
	const SpdxLicenseList: Readonly<Record<
		string,
		{
			readonly name: string;
			readonly url: string;
			readonly osiApproved: boolean;
		}
	>>;
	export = SpdxLicenseList;
}

declare module "spdx-license-list/full" {
	const SpdxLicenseListFull: Readonly<Record<
		string,
		{
			readonly name: string;
			readonly url: string;
			readonly osiApproved: boolean;
			readonly licenseText: string;
		}
	>>;
	export = SpdxLicenseListFull;
}
