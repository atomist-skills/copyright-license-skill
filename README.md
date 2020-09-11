# `atomist/copyright-license-skill`

<!---atomist-skill-description:start--->

Maintain repository license files and source code copyright headers

<!---atomist-skill-description:end--->

---

<!---atomist-skill-readme:start--->

## What it's useful for

Open source licenses recommend you include copy of the license and a
copyright/license header in each source code file in a repository.
This skill ensures your repositories contain the proper license file
and each source code file contains the proper license header with
up-to-date copyright.

## How it works

On each push to a configured repository, this skill ensures the
repository has the proper license file and that all files have the
proper license header with an up-to-date copyright notice. The
"proper" license can be provided in the skill configuration or
automatically determined by the contents of the `LICENSE` file in the
repository.

<!---atomist-skill-readme:end--->

---

Created by [Atomist][atomist].
Need Help? [Join our Slack workspace][slack].

[atomist]: https://atomist.com/ "Atomist - How Teams Deliver Software"
[slack]: https://join.atomist.com/ "Atomist Community Slack"
