import {App, TFile} from 'obsidian';

export class FileUtils {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	private readonly mediaExtensions = [
		// 图片格式
		'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp', '.tiff', '.tif', '.ico', '.heic', '.heif',
		'.raw', '.cr2', '.nef', '.arw', '.dng', '.orf', '.sr2', '.psd', '.xcf', '.ai', '.cdr', '.eps',

		// 视频格式
		'.mp4', '.webm', '.ogv', '.mov', '.mkv', '.avi', '.wmv', '.m4v', '.mpg', '.mpeg', '.flv', '.3gp',
		'.ts', '.vob', '.divx', '.asf', '.rm', '.rmvb', '.f4v', '.m2ts', '.h264', '.h265', '.mts',

		// 音频格式
		'.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.wma', '.aiff', '.alac', '.mid', '.midi',
		'.amr', '.ape', '.au', '.voc', '.opus', '.ra', '.ac3', '.dts',

		// 办公文档
		'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.rtf',
		'.txt', '.csv', '.tsv', '.xml', '.json', '.yaml', '.yml', '.tex', '.pages', '.numbers', '.key',

		// 电子书
		'.epub', '.mobi', '.azw', '.azw3', '.fb2', '.djvu', '.cbz', '.cbr','.cbt','.cb7',

		// 压缩和归档文件
		'.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.iso', '.tgz', '.lzma', '.cab',

		// 开发和编程文件
		'.exe', '.msi', '.bin', '.dmg', '.app', '.apk', '.ipa', '.deb', '.rpm', '.jar', '.class',
		'.py', '.js', '.html', '.css', '.php', '.java', '.c', '.cpp', '.h', '.sh', '.bat', '.ps1',
		'.swift', '.go', '.rs', '.rb', '.pl', '.ts', '.jsx', '.vue', '.sql', '.db', '.sqlite',

		// CAD和3D设计
		'.dwg', '.dxf', '.stl', '.obj', '.fbx', '.blend', '.3ds', '.max', '.skp', '.iges', '.step',

		// 字体文件
		'.ttf', '.otf', '.woff', '.woff2', '.eot', '.fon',

		// 数据库文件
		'.mdb', '.accdb', '.db', '.dbf', '.sqlite', '.sqlite3', '.pst', '.ost',

		// 虚拟机和容器
		'.vhd', '.vhdx', '.vmdk', '.ova', '.ovf', '.vbox',

		// 备份文件
		'.bak', '.old', '.tmp', '.temp', '.swp', '.sav', '.backup',

		// 系统和配置文件
		'.sys', '.ini', '.cfg', '.config', '.log', '.reg',

		// 演示文件
		'.pps', '.ppsx', '.sxi',

		// GIS和地图文件
		'.shp', '.kml', '.kmz', '.gpx',

		// 科学计算
		'.mat', '.nb', '.cdf', '.fits',

		// 视频编辑
		'.prproj', '.aep', '.drp', '.fcp', '.fcpx',

		// 工程文件
		'.vcxproj', '.sln', '.pbxproj', '.xcodeproj', '.gradle',

		'.canvas','.xhtml','.mhtml','.htm'
	];

	/**
	 * 检查文件是否存在于 Obsidian 库中
	 * @param fileName 文件名（不包含扩展名）
	 * @returns 是否存在
	 */
	isFileExistsInVault(fileName: string, checkPath: boolean = false): boolean {
		// 如果需要考虑路径
		if (checkPath) {
			// 直接检查完整路径是否存在（添加.md扩展名）
			const fileWithPath = this.app.vault.getAbstractFileByPath(`${fileName}.md`);
			return fileWithPath instanceof TFile;
		}

		// 不考虑路径的情况下，使用原有逻辑
		const matchedFile = this.app.metadataCache.getFirstLinkpathDest(fileName, '');
		return matchedFile !== null;
	}

	/**
	 * 检查文件
	 *
	 * 只检查文件名（basename），不考虑路径
	 * @param fileName 文件名
	 */
	getFileByFileName(fileName: string): TFile | null {
		return this.app.metadataCache.getFirstLinkpathDest(fileName, '');
	}

	getFileByFileNameV2(fileName: string): TFile | null {
		// 先尝试直接查找
		const directMatch = this.app.metadataCache.getFirstLinkpathDest(fileName, '');
		if (directMatch) return directMatch;

		// 如果没找到，去掉扩展名再试一次
		const baseFileName = fileName.replace(/\.[^/.]+$/, '');
		return this.app.metadataCache.getFirstLinkpathDest(baseFileName, '');
	}

	/**
	 * 根据文件名获取文件的完整路径
	 * @param fileName 文件名（不包含扩展名）
	 * @returns 文件的完整路径，如果未找到返回 null
	 */
	getFilePathByName(fileName: string): string | null {
		const matchedFile = this.app.metadataCache.getFirstLinkpathDest(fileName, '');
		return matchedFile ? matchedFile.path : null;
	}

	/**
	 * 判断文件名是否为媒体类型
	 * @param filename 文件名
	 * @returns 是否为媒体类型
	 */
	isMediaFile(filename: string): boolean {
		// 检查文件扩展名
		const lowerFilename = filename.toLowerCase();
		return this.mediaExtensions.some(ext => lowerFilename.endsWith(ext));
	}
}
