# Missing Link File Creator

English | [中文](./README.zh-cn.md)

An Obsidian plugin that detects and creates missing markdown files from links in your notes.

## Features

- **One-click creation** of missing files referenced in your notes
- **Smart link detection** for multiple link formats:
	- Standard links: `[[filename]]`
	- Links with aliases: `[[filename|alias]]`
	- Path-specific links: `[[path/to/filename]]`
	- Embedded links: `![[filename]]`
	- Links in resource directories: `[[resources/books/filename]]`
- **Bulk creation** of multiple missing files at once
- **Folder scanning** to create missing links from all notes in a folder
- **Alias preservation** - automatically adds aliases to frontmatter
- **Customizable default folder** for new files
- **Interactive confirmation dialog** to select which files to create


## Installation

1. Open Obsidian Settings > Community plugins
2. Disable Safe mode
3. Click "Browse" and search for "Missing Link File Creator"
4. Install the plugin and enable it


## Usage

### Commands


| Command                                    | Meaning                                                      |
| ------------------------------------------ | ------------------------------------------------------------ |
| Create Missing Links: Current File           | Check the links in the currently open Markdown document and automatically create any missing linked files. |
| Create Missing Links: Folder Scan | Scan all Markdown files in the folder of the currently open document, detect their linked references, and automatically create any missing files. |

Access these commands through the Command Palette (Ctrl/Cmd + P).

### Configuration

In the plugin settings, you can:

1. **Set a default folder path** for new files:
	- Click on the folder field
	- Use the dropdown to search and select an existing folder
	- Files without specific paths will be created here

2. **Enable notifications** for file creation events

3. **Enable debug mode** for troubleshooting (developers)

### Workflow Example

1. Write notes with links to files you plan to create later:
   ```markdown
   I need to research  [[Ancient Rome]]  and its connection to  [[Byzantine Empire|Byzantium]] .
   Also check the maps in ! [[Roman Territory Maps]] .
   ```

2. When ready to create these files:
	- Run the "Create Missing Links: Current File" command
	- Select which files to create in the confirmation dialog
	- Files will be created with any aliases preserved in frontmatter

![](resources/screenshots/img-QE10291201000001.png)

![](resources/screenshots/img-QE10291201000002.png)

### Notes

- Files with specific paths in links (e.g., `[[folder/file]]`) will be created in those locations
- Files without paths will be created in your default folder
- The plugin will not overwrite existing files unless you're adding new aliases

## Support

If you encounter any issues, please report them on the [GitHub repository](https://github.com/Lemon695/obsidian-missing-link-file-creator/issues).

# Plugin Use Cases

During document editing (e.g., "novel writing"), an article often exceeds 3,000 words, and many links, such as `[[Character Profiles]]` or `[[Task List]]`, are created during the writing process. However, these files may not have been created yet. With this plugin, you can quickly generate the corresponding files without manually creating them one by one, improving efficiency.









