# MutRoSe for Visual Studio Code

This extension ships all the needed tooling for modelling and decomposing missions with MutRoSe.

## What's included?

- MutRoSe Binary
- Custom text editor for `.gm` files, built on [`@istar-ts`](https://github.com/vieirin/istar-ts)
- A new Tree View for all .gm in the workspace

## System Requirements

### Modelling

    For the modelling part, any system should work as long as they can run the vscode.

### MutRoSe

- Ubuntu
- Python3
- ete4
- PyQt6

## How to use

Since the extension expects the same project pattern as the MutRoSe, your workspace needs to have the following structure:

- gm
- hddl
- knowledge
- output
- configuration

### Goal model editor

`.gm` files open in the [`@istar-ts`](https://github.com/vieirin/istar-ts) React editor (LSP
diagnostics on the canvas, MutRoSe GoalType coloring, G#/AT# naming). By default it is drawn in
the legacy React Flow look; to use the plain istar-ts look, set in your workspace settings:

```json
{
  "mutrose.istarTsReactFlowStyle": false
}
```

Re-open any `.gm` tab after changing the setting.

### Directories

#### Goal Model's (gm)

That's where you'll put all your goal models that you want to edit.
They should be the same format as the PiStar hosted by the UFPE generates, but they need to have the .gm file extension, otherwise they won't appear in the treeview nor open the custom text editor.

#### HDDL (hddl)

This directory should contain the hddl

#### Knowledge (knowledge)

This directory should contain the knowledge file in the xml format

#### Configuration

This directory should contain the configuration files that defines the output and world_knowledge paths.

### Basic Configuration

For the extension to work properly, the first step is to define the config and hddl path in the settings.json which can be located inside the .vscode folder of your workspace. If it doesn't exists, you should create it.
The extension expects the variables to contain the relative path for both files and it's only used to execute the MutRoSe properly.

#### Example for the variables

```json
{
	"gmParser.hddlPath": "hddl/FoodLogistics.hddl",
	"gmParser.configPath": "configuration/configurationDelivery.json",
	"mutrose.path": "binaries/mutrose"
}
```

- `gmParser.hddlPath`: Relative path to the HDDL file in the workspace.
- `gmParser.configPath`: Relative path to the configuration file in the workspace.
- `mutrose.path`: (Optional) Custom path to the MutRoSe binary. Can be an absolute path or relative to the workspace root. If omitted, the bundled binary in `binaries/mutrose` is used.

Besides that, the extension also expects the path inside the configuration file to be relative since MutRoSe is executed from the workspace's root.

Lastly, it's also needed to give permission for the MutRoSe binary to be executable and install ete4 with pip, that's usually done by running the following commands:

```
$ chmod +x <path_to_vscode_extensions_folder>/les-unb.mutrose-vscode-<current_extension_version>/binaries/mutrose
$ pip3 install PyQt6
$ pip3 install ete4
```

The path to vscode's extesions folder usually is `~/.vscode-server/extensions/les-unb.mutrose-vscode-<current_extension_version>/binaries/mutrose`

### macOS / Apple Silicon

The bundled `binaries/mutrose` is a Linux x86-64 binary and cannot run on macOS (it also
deadlocks under Docker/qemu emulation). Build a native binary instead:

```
$ tools/mutrose/build-macos.sh
```

This installs Boost/Bison/Flex via Homebrew, builds MutRoSe from source, and installs it to
`~/.local/bin/mutrose`. Then set in your workspace settings.json:

```json
{ "mutrose.path": "~/.local/bin/mutrose" }
```

**Known issue:** on some inputs the native macOS build silently produces an empty decomposition
(exit code 0, but `output/task_output.json` has empty `actions`/`tasks`/`mission_decompositions`)
even though a Linux build of the same commit decomposes correctly. The divergence traces back to
the knowledge-base query step (`world_db->select(...)` in the goal model) returning no results on
macOS; the root cause (likely a Boost `property_tree`/query-parser version sensitivity — Homebrew
ships a much newer Boost than the Linux distros this project was developed against) is still open.
If you hit this, use the Docker fallback instead, which runs a native-Linux build in a container:

```
$ tools/mutrose/mutrose-docker hddl/<file>.hddl gm/<file>.gm configuration/configuration.json -p
```

The first run builds the `mutrose:arm64` image (requires Docker Desktop/Orbstack with native
arm64 support — the bundled Linux x86-64 `binaries/mutrose` deadlocks under qemu emulation, but a
natively-built arm64 image does not). Point `mutrose.path` at the wrapper script itself if you want
the extension to use it.

### How to model

For using the Tree View it should mostly be intuitive, but the main idea is to right click every type of element to interact with them. For example, if you right click a Goal, all available options related to the goal will appear in a menu.

In the goal model editor, elements (actors, goals and tasks) are numbered automatically when created. To save the file, press CTRL-S or save it like you normally would in VSCode.
