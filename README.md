# MutRoSe for Visual Studio Code
This extension ships all the needed tooling for modelling and decomposing missions with MutRoSe.
## What's included?
- MutRoSe Binary
- PiStar as an Custom Text Editor for .gm files
- A new Tree View for all .gm in the workspace

## System Requirements
For the modelling part, any system should work as long as they can run the vscode.
But, for executing the MutRoSe, it's required a linux system. Ubuntu is recommended since that's the target distro for the MutRoSe binary, but it should work with other distributions.

## How to use
Since the extension expects the same project pattern as the MutRoSe, your workspace needs to have the following structure:
- gm
- hddl
- knowledge
- output
- configuration
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
```
{
	"gmParser.hddlPath": "../hddl/FoodLogistics.hddl",
	"gmParser.configPath": "../configuration/configurationDelivery.json"
}
```

Besides that, the extension expects the path inside the configuration file to be absolute, so it can be found independently of where the MutRoSe is executed from.

Lastly, it's also needed to give permission for the MutRoSe binary to be executable, that's usually done by running the following command:
```
$ chmod +x <path_to_vscode_extensions_folder>/les-unb.mutrose-vscode-0.0.1/binaries/mutrose
```
The path to vscode's extesions folder usually is `~/.vscode-server/extensions/les-unb.mutrose-vscode-0.0.1/binaries/mutrose`

### How to model
For using the Tree View it should mostly be intuitive, but the main idea is to right click every type of element to interact with them. For example, if you right click a Goal, all available options related to the goal will appear in a menu.

For the piStar, almost everything continues the same as the one hosted by the UFPE. The exceptions are while creating a element and saving the model:
- When you create an element (actor, goal or task), it's numerated automatically.
- To save the file you just need to press CTRL-S or save the file like you normally would do with VSCode.

### Known Bugs & workarounds
#### PiStar is empty on opening a file
Sometimes when you open a .gm file, the pistar can be entirely empty. To solve that you just need to save the file with CTRL-S or something equivalent and it should correct it self.
#### Can't delete a element
When you try select a element and delete sometimes it appears to do nothing. Usually that happens because the focus, even though you clicked on the editor, is on the wrong tab of the VSCode and to solve that you just need to click on the right tab (where the name of the tab is).
#### Enumeration isn't working
When you create a new element using the PiStar menu, sometimes the enumeration doesn't appear even though the text file is correct. That usually happens when more than one element is created without saving the file. To solve that, you just need to save it.