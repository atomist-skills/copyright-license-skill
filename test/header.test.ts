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

import { log } from "@atomist/skill";
import * as asert from "assert";
import * as assert from "power-assert";

import {
	copyrightHeaderRegExp,
	licenseHeader,
	preambleRegExp,
	prefixHeader,
	updateCopyrightHeader,
} from "../lib/header";

describe("header", () => {
	describe("copyrightHeaderRegExp", () => {
		it("matches a C block header", () => {
			const re = copyrightHeaderRegExp("//");
			const c = `/*
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

import * as assert from "power-assert";
import { headerRegExp, licenseHeader } from "../lib/header";
`;
			const m = re.exec(c);
			asert(m);
			assert(m.length === 3);
			assert(
				m[0] ===
					`/*
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
`,
			);
			assert(m[1] === undefined);
			assert(m[2] === "2020");
		});

		it("matches a C line header", () => {
			const re = copyrightHeaderRegExp("//");
			const c = `// Copyright (C) 2020 Atomist, Inc.
//
// Licensed under the BSD 3-Clause "New" or "Revised" License;
// you may not use this file except in compliance with the License.
#include <stdio.h>;
int main() {
    return 0;
}
`;
			const m = re.exec(c);
			asert(m);
			assert(m.length === 3);
			assert(
				m[0] ===
					`// Copyright (C) 2020 Atomist, Inc.
//
// Licensed under the BSD 3-Clause "New" or "Revised" License;
// you may not use this file except in compliance with the License.
`,
			);
			assert(m[1] === "2020");
			assert(m[2] === undefined);
		});

		it("matches a script header", () => {
			const re = copyrightHeaderRegExp("#");
			const c = `#! /bin/bash
# Copyright © 2015 Atomist, Inc.
#
# Licensed under the MIT license;
# you may not use this file except in compliance with the License.

declare Pkg=something
declare Version=0.1.0

function msg () {
    echo "$Pkg: $*"
}
`;
			const m = re.exec(c);
			asert(m);
			assert(m.length === 2);
			assert(
				m[0] ===
					`# Copyright © 2015 Atomist, Inc.
#
# Licensed under the MIT license;
# you may not use this file except in compliance with the License.
`,
			);
			assert(m[1] === "2015");
		});

		it("matches a lisp header", () => {
			const re = copyrightHeaderRegExp(";");
			const c = `;; This does something
;; Copyright (c) 1999 Atomist, Inc.
;;
;; This program is free software: you can redistribute it and/or modify
;; it under the terms of the GNU General Public License as published by
;; the Free Software Foundation, either version 3 of the License, or
;; (at your option) any later version.
;;
;; This program is distributed in the hope that it will be useful,
;; but WITHOUT ANY WARRANTY; without even the implied warranty of
;; MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
;; GNU General Public License for more details.
;;
;; You should have received a copy of the GNU General Public License
;; along with this program.  If not, see <https://www.gnu.org/licenses/>.

 
(cdr 'x)
`;
			const m = re.exec(c);
			asert(m);
			assert(m.length === 2);
			assert(
				m[0] ===
					`;; Copyright (c) 1999 Atomist, Inc.
;;
;; This program is free software: you can redistribute it and/or modify
;; it under the terms of the GNU General Public License as published by
;; the Free Software Foundation, either version 3 of the License, or
;; (at your option) any later version.
;;
;; This program is distributed in the hope that it will be useful,
;; but WITHOUT ANY WARRANTY; without even the implied warranty of
;; MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
;; GNU General Public License for more details.
;;
;; You should have received a copy of the GNU General Public License
;; along with this program.  If not, see <https://www.gnu.org/licenses/>.
`,
			);
			assert(m[1] === "1999");
		});

		it("matches a script header after some guff", () => {
			const re = copyrightHeaderRegExp("#");
			const c = `#! /bin/bash
# Some guff
# that describes what this
# script does

set -o pipefail

# Copyright © 2015 Atomist, Inc.
#
# Licensed under the MIT License;
# you may not use this file except in compliance with the License.

declare Pkg=something
declare Version=0.1.0

function msg () {
    echo "$Pkg: $*"
}
`;
			const m = re.exec(c);
			asert(m);
			assert(m.length === 2);
			assert(
				m[0] ===
					`# Copyright © 2015 Atomist, Inc.
#
# Licensed under the MIT License;
# you may not use this file except in compliance with the License.
`,
			);
			assert(m[1] === "2015");
		});
	});

	describe("licenseHeader", () => {
		it("returns the default", () => {
			const y = new Date().getFullYear().toString(10);
			const c = "E-Corp, Inc.";
			const ins = [
				{ i: "Artistic-2.0", n: "Artistic License 2.0 License" },
				{
					i: "BSD-3-Clause",
					n: `BSD 3-Clause "New" or "Revised" License`,
				},
				{
					i: "CC0-1.0",
					n: "Creative Commons Zero v1.0 Universal License",
				},
				{ i: "OSL-3.0", n: "Open Software License 3.0 License" },
			];
			ins.forEach(i => {
				const e =
					`Copyright © ${y} ${c}\n\nLicensed under the ${i.n};\n` +
					`you may not use this file except in compliance with the License.`;
				const h = licenseHeader({ copyrightHolder: c, id: i.i });
				assert(h === e);
			});
		});

		it("extracts license usage from license", () => {
			const y = new Date().getFullYear().toString(10);
			const c = "E-Corp, Inc.";
			const ins = [
				{
					i: "AGPL-3.0",
					n: "GNU Affero General Public License v3.0",
					e: `Copyright © ${y} ${c}

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.`,
				},
				{
					i: "AGPL-3.0-only",
					n: "GNU Affero General Public License v3.0 only",
					e: `Copyright © ${y} ${c}

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.`,
				},
				{
					i: "AGPL-3.0-or-later",
					n: "GNU Affero General Public License v3.0 or later",
					e: `Copyright © ${y} ${c}

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.`,
				},
				{
					i: "Apache-2.0",
					n: "Apache License 2.0",
					e: `Copyright © ${y} ${c}

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`,
				},
				{
					i: "ECL-2.0",
					n: "Educational Community License v2.0",
					e: `Copyright © ${y} ${c} Licensed under the
Educational Community License, Version 2.0 (the "License"); you may
not use this file except in compliance with the License. You may
obtain a copy of the License at

    http://www.osedu.org/licenses/ECL-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an "AS IS"
BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
or implied. See the License for the specific language governing
permissions and limitations under the License.`,
				},
				{
					i: "GPL-1.0",
					n: "GNU General Public License v1.0 only",
					e: `Copyright © ${y} ${c}

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 1, or (at your option)
any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 675 Mass Ave, Cambridge, MA 02139, USA.`,
				},
				{
					i: "GPL-1.0+",
					n: "GNU General Public License v1.0 or later",
					e: `Copyright © ${y} ${c}

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 1, or (at your option)
any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 675 Mass Ave, Cambridge, MA 02139, USA.`,
				},
				{
					i: "GPL-1.0-only",
					n: "GNU General Public License v1.0 only",
					e: `Copyright © ${y} ${c}

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 1, or (at your option)
any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 675 Mass Ave, Cambridge, MA 02139, USA.`,
				},
				{
					i: "GPL-1.0-or-later",
					n: "GNU General Public License v1.0 or later",
					e: `Copyright © ${y} ${c}

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 1, or (at your option)
any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 675 Mass Ave, Cambridge, MA 02139, USA.`,
				},
				{
					i: "GPL-2.0",
					n: "GNU General Public License v2.0 only",
					e: `Copyright © ${y} ${c}

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.`,
				},
				{
					i: "GPL-2.0+",
					n: "GNU General Public License v2.0 or later",
					e: `Copyright © ${y} ${c}

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.`,
				},
				{
					i: "GPL-2.0-only",
					n: "GNU General Public License v2.0 only",
					e: `Copyright © ${y} ${c}

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.`,
				},
				{
					i: "GPL-2.0-or-later",
					n: "GNU General Public License v2.0 or later",
					e: `Copyright © ${y} ${c}

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.`,
				},
				{
					i: "GPL-3.0",
					n: "GNU General Public License v3.0 only",
					e: `Copyright © ${y} ${c}

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.`,
				},
				{
					i: "GPL-3.0+",
					n: "GNU General Public License v3.0 or later",
					e: `Copyright © ${y} ${c}

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.`,
				},
				{
					i: "GPL-3.0-only",
					n: "GNU General Public License v3.0 only",
					e: `Copyright © ${y} ${c}

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.`,
				},
				{
					i: "GPL-3.0-or-later",
					n: "GNU General Public License v3.0 or later",
					e: `Copyright © ${y} ${c}

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.`,
				},
				{
					i: "ImageMagick",
					n: "ImageMagick License",
					e: `Copyright © ${y} ${c}

Licensed under the ImageMagick License (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy
of the License at

  http://www.imagemagick.org/script/license.php

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations
under the License.`,
				},
				{
					i: "LGPL-2.0",
					n: "GNU Library General Public License v2 only",
					e: `Copyright © ${y} ${c}

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Library General Public
License as published by the Free Software Foundation; either
version 2 of the License, or (at your option) any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
Library General Public License for more details.

You should have received a copy of the GNU Library General Public
License along with this library; if not, write to the Free Software
Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301, USA.`,
				},
				{
					i: "LGPL-2.0+",
					n: "GNU Library General Public License v2 or later",
					e: `Copyright © ${y} ${c}

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Library General Public
License as published by the Free Software Foundation; either
version 2 of the License, or (at your option) any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
Library General Public License for more details.

You should have received a copy of the GNU Library General Public
License along with this library; if not, write to the Free Software
Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301, USA.`,
				},
				{
					i: "LGPL-2.0-only",
					n: "GNU Library General Public License v2 only",
					e: `Copyright © ${y} ${c}

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Library General Public
License as published by the Free Software Foundation; either
version 2 of the License, or (at your option) any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
Library General Public License for more details.

You should have received a copy of the GNU Library General Public
License along with this library; if not, write to the Free Software
Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301, USA.`,
				},
				{
					i: "LGPL-2.0-or-later",
					n: "GNU Library General Public License v2 or later",
					e: `Copyright © ${y} ${c}

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Library General Public
License as published by the Free Software Foundation; either
version 2 of the License, or (at your option) any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
Library General Public License for more details.

You should have received a copy of the GNU Library General Public
License along with this library; if not, write to the Free Software
Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301, USA.`,
				},
				{
					i: "LGPL-2.1",
					n: "GNU Lesser General Public License v2.1 only",
					e: `Copyright © ${y} ${c}

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation; either
version 2.1 of the License, or (at your option) any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this library; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.`,
				},
				{
					i: "LGPL-2.1+",
					n: "GNU Library General Public License v2.1 or later",
					e: `Copyright © ${y} ${c}

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation; either
version 2.1 of the License, or (at your option) any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this library; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA`,
				},
				{
					i: "LGPL-2.1-only",
					n: "GNU Lesser General Public License v2.1 only",
					e: `Copyright © ${y} ${c}

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation; either
version 2.1 of the License, or (at your option) any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this library; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301.`,
				},
				{
					i: "LGPL-2.1-or-later",
					n: "GNU Lesser General Public License v2.1 or later",
					e: `Copyright © ${y} ${c}

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation; either
version 2.1 of the License, or (at your option) any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this library; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA`,
				},
				{
					i: "MulanPSL-1.0",
					n: "Mulan Permissive Software License, Version 1",
					e: `Copyright © ${y} ${c}

This software is licensed under the Mulan PSL v1.

You can use this software according to the terms and conditions of the
Mulan PSL v1.

You may obtain a copy of Mulan PSL v1 at:

    http://license.coscl.org.cn/MulanPSL

THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF
ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
NON-INFRINGEMENT, MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.

See the Mulan PSL v1 for more details.`,
				},
				{
					i: "SHL-0.5",
					n: "Solderpad Hardware License v0.5",
					e: `Copyright © ${y} ${c}

Copyright and related rights are licensed under the Solderpad Hardware
License, Version 0.5 (the "License"); you may not use this file except
in compliance with the License. You may obtain a copy of the License
at http://solderpad.org/licenses/SHL-0.5. Unless required by
applicable law or agreed to in writing, software, hardware and
materials distributed under this License is distributed on an "AS IS"
BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied. See the License for the specific language governing
permissions and limitations under the License.`,
				},
				{
					i: "SHL-0.51",
					n: "Solderpad Hardware License, Version 0.51",
					e: `Copyright © ${y} ${c}

Copyright and related rights are licensed under the Solderpad Hardware
License, Version 0.51 (the "License"); you may not use this file
except in compliance with the License. You may obtain a copy of the
License at http://solderpad.org/licenses/SHL-0.51. Unless required by
applicable law or agreed to in writing, software, hardware and
materials distributed under this License is distributed on an "AS IS"
BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied. See the License for the specific language governing
permissions and limitations under the License.`,
				},
			];
			ins.forEach(i => {
				const h = licenseHeader({ copyrightHolder: c, id: i.i });
				assert(h === i.e, i.i);
			});
		});
	});

	describe("preambleRegExp", () => {
		it("does not match nothing", () => {
			const cs = [
				{
					p: "#",
					c: `import * from "fs";\nconsole.log("real code");\n`,
				},
				{
					p: "//",
					c: `#include <stdio.h>\n\nint main() {\n  printf("Nothing\n");\n  return 0;\n}\n`,
				},
				{ p: ";", c: `\n\n(let (x '0)\n  x)\n` },
			];
			for (const c of cs) {
				assert(preambleRegExp(c.p).test(c.c) === false);
			}
		});

		it("matches shebang", () => {
			const re = preambleRegExp("#");
			const c = `#! /bin/sh\n\nset +e\nexit 0\n`;
			const m = re.exec(c);
			asert(m);
			assert(m[0] === "#! /bin/sh\n");
		});

		it("matches file description comments", () => {
			const cs = [
				{
					p: "#",
					c: `# super fun script\n# that does super cool things\n\necho "real code"\n`,
					e: `# super fun script\n# that does super cool things\n`,
				},
				{
					p: "//",
					c: `// this code needs compiled\n// or you can just\n//think about it\n\n// more\n#include <stdio.h>\n\nint main() {\n  printf("Nothing\n");\n  return 0;\n}\n`,
					e: `// this code needs compiled\n// or you can just\n//think about it\n`,
				},
				{
					p: ";",
					c: `;; lisp lisping lispy lisps\n(let (x '0)\n  x)\n`,
					e: `;; lisp lisping lispy lisps\n`,
				},
				{
					p: "//",
					c: `/* this code needs compiled\n * or you can just\n * think about it\n\n * more */\n#include <stdio.h>\n\nint main() {\n  printf("Nothing\n");\n  return 0;\n}\n`,
					e: `/* this code needs compiled\n * or you can just\n * think about it\n\n * more */`,
				},
			];
			for (const c of cs) {
				const re = preambleRegExp(c.p);
				const m = re.exec(c.c);
				asert(m);
				assert(m[0] === c.e);
			}
		});

		it("matches shebang and file description comments", () => {
			const re = preambleRegExp("#");
			const c = `#! /bin/sh\n# this script does# not do much\nset +e\nexit 0\n`;
			const m = re.exec(c);
			asert(m);
			assert(m[0] === "#! /bin/sh\n# this script does# not do much\n");
		});
	});

	describe("prefixHeader", () => {
		it("prepends C comment", () => {
			const c = `Copyright © 2020 Atomist, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`;
			const h = prefixHeader({
				blockComment: false,
				header: c,
				prefix: "//",
			});
			const e = `// Copyright © 2020 Atomist, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
`;
			assert(h === e);
		});

		it("creates C block comment", () => {
			const c = `Copyright © 2020 Atomist, Inc.

Licensed under the Apache License, Version 1.0;
you may not use this file except in compliance with the License.`;
			const h = prefixHeader({
				blockComment: true,
				header: c,
				prefix: "//",
			});
			const e = `/*
 * Copyright © 2020 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 1.0;
 * you may not use this file except in compliance with the License.
 */
`;
			assert(h === e);
		});

		it("prepends script comment", () => {
			const c = `Copyright © 2015 Atomist, Inc.

Licensed under the MIT license;
you may not use this file except in compliance with the License.`;
			const h = prefixHeader({
				blockComment: false,
				header: c,
				prefix: "#",
			});
			const e = `# Copyright © 2015 Atomist, Inc.
#
# Licensed under the MIT license;
# you may not use this file except in compliance with the License.
`;
			assert(h === e);
		});

		it("prepends lisp comment", () => {
			const c = `Copyright (c) 1999 Atomist, Inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.`;
			const h = prefixHeader({
				blockComment: true,
				header: c,
				prefix: ";",
			});
			const e = `;; Copyright (c) 1999 Atomist, Inc.
;;
;; This program is free software: you can redistribute it and/or modify
;; it under the terms of the GNU General Public License as published by
;; the Free Software Foundation, either version 3 of the License, or
;; (at your option) any later version.
;;
;; This program is distributed in the hope that it will be useful,
;; but WITHOUT ANY WARRANTY; without even the implied warranty of
;; MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
;; GNU General Public License for more details.
;;
;; You should have received a copy of the GNU General Public License
;; along with this program.  If not, see <https://www.gnu.org/licenses/>.
`;
			assert(h === e);
		});

		it("does nothing successfully", () => {
			const c = ``;
			const h = prefixHeader({
				blockComment: false,
				header: c,
				prefix: "//",
			});
			assert(h === c);
		});
	});

	describe("updateCopyrightHeader", () => {
		let originalLogDebug: any;
		before(() => {
			originalLogDebug = Object.getOwnPropertyDescriptor(log, "debug");
			Object.defineProperty(log, "debug", {
				value: () => {
					return;
				},
			});
		});
		after(() => {
			Object.defineProperty(log, "debug", originalLogDebug);
		});

		it("adds copyright header", () => {
			const a = {
				blockComment: false,
				content: `#include <math.h>\nint main() {\n  return pow(1, 0);\n}\n`,
				file: "anodyne.c",
				header: `Copyright © 2015 Atomist, Inc.\n\nLicensed under the 0BSD license;\nyou may not use this file except in compliance with the License.`,
				updateYear: false,
			};
			const c = updateCopyrightHeader(a);
			const e = `// Copyright © 2015 Atomist, Inc.
//
// Licensed under the 0BSD license;
// you may not use this file except in compliance with the License.

#include <math.h>
int main() {
  return pow(1, 0);
}
`;
			assert(c === e);
		});

		it("adds copyright header as block comment", () => {
			const a = {
				content: `#include <math.h>\nint main() {\n  return pow(1, 0);\n}\n`,
				file: "anodyne.c",
				header: `Copyright © 2018 Atomist, Inc.\n\nLicensed under the 0BSD license;\nyou may not use this file except in compliance with the License.`,
				updateYear: false,
				blockComment: true,
			};
			const c = updateCopyrightHeader(a);
			const e = `/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the 0BSD license;
 * you may not use this file except in compliance with the License.
 */

#include <math.h>
int main() {
  return pow(1, 0);
}
`;
			assert(c === e);
		});

		it("adds copyright header removing extra space", () => {
			const a = {
				blockComment: false,
				content: `\n\n\n\n#include <math.h>\nint main() {\n  return pow(1, 0);\n}\n`,
				file: "anodyne.c",
				header: `Copyright © 2015 Atomist, Inc.\n\nLicensed under the 0BSD license;\nyou may not use this file except in compliance with the License.`,
				updateYear: false,
			};
			const c = updateCopyrightHeader(a);
			const e = `// Copyright © 2015 Atomist, Inc.
//
// Licensed under the 0BSD license;
// you may not use this file except in compliance with the License.

#include <math.h>
int main() {
  return pow(1, 0);
}
`;
			assert(c === e);
		});

		it("adds block copyright header removing extra space", () => {
			const a = {
				blockComment: true,
				content: `\n\n\n\n#include <math.h>\nint main() {\n  return pow(1, 0);\n}\n`,
				file: "anodyne.c",
				header: `Copyright © 2018 Atomist, Inc.\n\nLicensed under the 0BSD license;\nyou may not use this file except in compliance with the License.`,
				updateYear: false,
			};
			const c = updateCopyrightHeader(a);
			const e = `/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the 0BSD license;
 * you may not use this file except in compliance with the License.
 */

#include <math.h>
int main() {
  return pow(1, 0);
}
`;
			assert(c === e);
		});

		it("does not update copyright year", () => {
			const a = {
				blockComment: false,
				content: `; Copyright © 2015 Atomist, Inc.
;
; Licensed under the MIT license;
; you may not use this file except in compliance with the License.
(let (x '0) x)
`,
				file: "emmylou.cljs",
				header: `Copyright © 2020 Atomist, Inc.\n\nLicensed under the MIT license;\nyou may not use this file except in compliance with the License.`,
				updateYear: false,
			};
			const c = updateCopyrightHeader(a);
			assert(c === a.content);
		});

		it("updates copyright year", () => {
			const y = new Date().getFullYear().toString(10);
			const a = {
				content: `#!/bin/sh
# Copyright (c) 2015 Atomist, Inc.
#
# Licensed under the MIT license;
# you may not use this file except in compliance with the License.
echo bye
`,
				file: "gram.ksh",
				header: `Copyright © ${y} Atomist, Inc.\n\nLicensed under the MIT license;\nyou may not use this file except in compliance with the License.`,
				updateYear: true,
				blockComment: true,
			};
			const c = updateCopyrightHeader(a);
			const e = `#!/bin/sh
# Copyright © ${y} Atomist, Inc.
#
# Licensed under the MIT license;
# you may not use this file except in compliance with the License.
echo bye
`;
			assert(c === e);
		});

		it("recognizes copyright year is up to date", () => {
			const y = new Date().getFullYear().toString(10);
			const a = {
				blockComment: false,
				content: `/*
 * Copyright © ${y} Atomist, Inc.
 *
 * Licensed under the MIT license;
 * you may not use this file except in compliance with the License.
 */

fun main(args : Array<String>) {
    println("Hello, World!")
}
`,
				file: "chris.kt",
				header: `Copyright (C) ${y} Junko, Inc.\n\nLicensed under the BSD license;\nyou may not use this file except in compliance with the License.`,
				updateYear: true,
			};
			const c = updateCopyrightHeader(a);
			assert(c === a.content);
		});

		it("replaces copyright header with block comment", () => {
			const a = {
				blockComment: true,
				content: `// Copyright © 2015 Atomist, Inc.
//
// Licensed under the 0BSD license;
// you may not use this file except in compliance with the License.

#include <math.h>\nint main() {\n  return pow(1, 0);\n}\n`,
				file: "anodyne.c",
				header: `Copyright © 2019 Atomist, Inc.\n\nLicensed under the MIT license;\nyou may not use this file except in compliance with the License.`,
				updateYear: true,
			};
			const c = updateCopyrightHeader(a);
			const e = `/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the MIT license;
 * you may not use this file except in compliance with the License.
 */

#include <math.h>
int main() {
  return pow(1, 0);
}
`;
			assert(c === e);
		});

		it("replaces copyright header retaining space", () => {
			const a = {
				blockComment: false,
				content: `// Copyright © 2015 Atomist, Inc.
//
// Licensed under the 0BSD license;
// you may not use this file except in compliance with the License.



#include <math.h>\nint main() {\n  return pow(1, 0);\n}\n`,
				file: "anodyne.c",
				header: `Copyright © 2019 Atomist, Inc.\n\nLicensed under the MIT license;\nyou may not use this file except in compliance with the License.`,
				updateYear: true,
			};
			const c = updateCopyrightHeader(a);
			const e = `// Copyright © 2019 Atomist, Inc.
//
// Licensed under the MIT license;
// you may not use this file except in compliance with the License.



#include <math.h>
int main() {
  return pow(1, 0);
}
`;
			assert(c === e);
		});

		it("replaces copyright header with block comment retaining space", () => {
			const a = {
				blockComment: true,
				content: `// Copyright © 2015 Atomist, Inc.
//
// Licensed under the 0BSD license;
// you may not use this file except in compliance with the License.



#include <math.h>\nint main() {\n  return pow(1, 0);\n}\n`,
				file: "anodyne.c",
				header: `Copyright © 2019 Atomist, Inc.\n\nLicensed under the MIT license;\nyou may not use this file except in compliance with the License.`,
				updateYear: true,
			};
			const c = updateCopyrightHeader(a);
			const e = `/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the MIT license;
 * you may not use this file except in compliance with the License.
 */



#include <math.h>
int main() {
  return pow(1, 0);
}
`;
			assert(c === e);
		});

		it("replaces block header with block comment retaining space", () => {
			const a = {
				blockComment: true,
				content: `/*
 * Copyright © 2015 Atomist, Inc.
 *
 * Licensed under the 0BSD license;
 * you may not use this file except in compliance with the License.
 */



#include <math.h>\nint main() {\n  return pow(1, 0);\n}\n`,
				file: "anodyne.c",
				header: `Copyright © 2021 Atomist, Inc.\n\nLicensed under the MIT license;\nyou may not use this file except in compliance with the License.`,
				updateYear: true,
			};
			const c = updateCopyrightHeader(a);
			const e = `/*
 * Copyright © 2021 Atomist, Inc.
 *
 * Licensed under the MIT license;
 * you may not use this file except in compliance with the License.
 */



#include <math.h>
int main() {
  return pow(1, 0);
}
`;
			assert(c === e);
		});

		it("adds header to YAML", () => {
			const a = {
				blockComment: true,
				content: `foo:\n  bar:\n  - baz\n  - 1763\n`,
				file: "a.yaml",
				header: `Copyright © 2021 Atomist, Inc.\n\nLicensed under the MIT license;\nyou may not use this file except in compliance with the License.`,
				updateYear: false,
			};
			const c = updateCopyrightHeader(a);
			const e = `# Copyright © 2021 Atomist, Inc.
#
# Licensed under the MIT license;
# you may not use this file except in compliance with the License.

foo:
  bar:
  - baz
  - 1763
`;
			assert(c === e);
		});

		it("adds line header to empty file", () => {
			const a = {
				blockComment: false,
				content: ``,
				file: "empty.test.ts",
				header: `Copyright © 2021 Atomist, Inc.\n\nLicensed under the MIT license;\nyou may not use this file except in compliance with the License.`,
				updateYear: false,
			};
			const c = updateCopyrightHeader(a);
			const e = `// Copyright © 2021 Atomist, Inc.
//
// Licensed under the MIT license;
// you may not use this file except in compliance with the License.
`;
			assert(c === e);
		});

		it("adds block header to empty file", () => {
			const a = {
				blockComment: true,
				content: ``,
				file: "empty.test.ts",
				header: `Copyright © 2021 Atomist, Inc.\n\nLicensed under the MIT license;\nyou may not use this file except in compliance with the License.`,
				updateYear: false,
			};
			const c = updateCopyrightHeader(a);
			const e = `/*
 * Copyright © 2021 Atomist, Inc.
 *
 * Licensed under the MIT license;
 * you may not use this file except in compliance with the License.
 */
`;
			assert(c === e);
		});

		it("adds header to file with just space", () => {
			const a = {
				blockComment: true,
				content: `   \n\n  \n`,
				file: "nil.cl",
				header: `Copyright © 2021 Atomist, Inc.\n\nLicensed under the MIT license;\nyou may not use this file except in compliance with the License.`,
				updateYear: false,
			};
			const c = updateCopyrightHeader(a);
			const e = `;; Copyright © 2021 Atomist, Inc.
;;
;; Licensed under the MIT license;
;; you may not use this file except in compliance with the License.
`;
			assert(c === e);
		});

		it("adds header after block comment preamble", () => {
			const a = {
				blockComment: true,
				content: `/**
 * This code does something.
 */`,
				file: "i-am-easy-to-find.cc",
				header: `Copyright © 2021 Dennis Ritchie

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.`,
				updateYear: false,
			};
			const c = updateCopyrightHeader(a);
			const e = `/**
 * This code does something.
 */
/*
 * Copyright © 2021 Dennis Ritchie
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
`;
			assert(c === e);
		});

		it("adds header between block comment preamble and code", () => {
			const a = {
				blockComment: true,
				content: `/**
 * This code does something.
 */

double add(double x, double y) {
  return x + y;
}
`,
				file: "roman-holiday.c",
				header: `Copyright © 2019 Atomist, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`,
				updateYear: false,
			};
			const c = updateCopyrightHeader(a);
			const e = `/**
 * This code does something.
 */
/*
 * Copyright © 2019 Atomist, Inc.
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

double add(double x, double y) {
  return x + y;
}
`;
			assert(c === e);
		});

		it("adds header to line comment preamble with block end", () => {
			const a = {
				blockComment: true,
				content: "// This code does something. */\n",
				file: "something.js",
				header: `Copyright © 2021 Atomist, Inc.\n\nLicensed under the MIT license;\nyou may not use this file except in compliance with the License.`,
				updateYear: false,
			};
			const c = updateCopyrightHeader(a);
			const e = `// This code does something. */
/*
 * Copyright © 2021 Atomist, Inc.
 *
 * Licensed under the MIT license;
 * you may not use this file except in compliance with the License.
 */
`;
			assert(c === e);
		});
	});
});
