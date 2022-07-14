const path = require("path");
const fs = require("fs");
const { Agent } = require("https");
const asyncjs = require("async");
const winston = require("winston");
const request = require("request");
const urljoin = require("url-join");
const Unrar = require("./unrar");
const extract = require("extract-zip");
const sha1_file = require("sha1-file");
const fsExtra = require('fs-extra')

const { exec, spawn, execFile } = require("child_process");

const escape = require("escape-path-with-spaces");
const findJavaHome = require("find-java-home");
const { promisify } = require("util");

const DEBUG = false;

// main path
const PIXEL_DIR = path.join(require("os").homedir(), ".pixel");
const BIN_PATH = path.join(PIXEL_DIR, "bin");
const FILES_PATH = path.join(PIXEL_DIR, "files");
const NATIVE_WIN_PATH = path.join(FILES_PATH, "native-win");

// appdata
const APPDATA_DIR = process.env["APPDATA"];
const GAME_DIR = path.join(APPDATA_DIR, ".pixelmc", "profiles", "pixelmon-8.4.2");

// other path
const MOD_PATH = path.join(GAME_DIR, "mods");
const LIB_PATH = path.join(GAME_DIR, "libraries");
const META_PATH = path.join(GAME_DIR, "versions");

// assets path
const ASSETS_PATH = path.join(GAME_DIR, "assets");
const OBJECTS_PATH = path.join(ASSETS_PATH, "objects");
const INDEXES_PATH = path.join(ASSETS_PATH, "indexes");
const LOG_CONFIGS_PATH = path.join(ASSETS_PATH, "log_configs");
	
// obj
const MC_VERSIONS = {};
var CUSTOM_FOLDERS = [];

// jre path
const JRE_PATH = path.join(PIXEL_DIR, "jre");
const JRE_PATH_32 = path.join(JRE_PATH, "x32");
const JRE_PATH_64 = path.join(JRE_PATH, "x64");
const JRE_32 = path.join(JRE_PATH, "x32.zip");
const JRE_64 = path.join(JRE_PATH, "x64.zip");

// version path
const VERSION_MANIFEST_URL = "https://launchermeta.mojang.com/mc/game/version_manifest.json";
const VERSION_MANIFEST_PATH = path.join(PIXEL_DIR, "version_manifest.json");

// forge libs path
var MC_FORGE_LIBS = path.join(PIXEL_DIR, "forge_libs.json");
const MC_FORGE_LIBS_URL = "https://pixelmc.vn/uploads/forge_libs_57c76af2a3.json";

// custom path
const CUSTOM_URL = "https://pixelmc.vn/uploads/custom_c1ab54c4d5.json";
const CUSTOM_URL_PATH = path.join(PIXEL_DIR, "custom.json");

// server.dat path
const SERVER_DAT_URL = "https://pixelmc.vn/uploads/servers.dat";
const SERVER_DAT_PATH = path.join(GAME_DIR, "servers.dat");

// resource path
const RESOURCE_URL = "https://resources.download.minecraft.net/";

// logger func
const logFormat = winston.format.printf((info) => `[${info.timestamp} ${info.level}] [${info.label}]: ${info.message}`);
const logger = winston.createLogger({
	format: winston.format.combine(
		winston.format.label({ label: "Installer" }),
		winston.format.timestamp({ format: "DD-MM-YYYY HH:mm:ss" }),
		winston.format.metadata({ fillExcept: ["message", "level", "timestamp", "label"] })
	),
	transports: [
		new winston.transports.Console({
			format: winston.format.combine(winston.format.colorize(), logFormat)
		}),
		new winston.transports.File({ filename: path.join(PIXEL_DIR, "latest.log") })
	]
});

var JAVA, USERNAME, PASSWORD, MEMORY, INDEX_VERSION, EVENT;
var INITIALIZED = false, DOWNLOADING = false;
var DUPLICATE_LIBRARIES = new Set();
var LOG_CONFIG;

const p1 = "Đang tải thông tin phiên bản...";
const p2 = "Đang tải các thư viện cần thiết...";
const p3 = "Đang tải các tài nguyên cho game...";
const p4 = "Xác nhận thư viện hoàn tất.";
const p5 = "Xác nhận tài nguyên hoàn tất.";
const p6 = "Lỗi bất ngờ đã xảy ra!";
const p7 = "Đang tải Java Runtime...";
const p8 = "Đã cài đặt xong Java...";
const p9 = "Đang kiểm tra Java Runtime...";
const p10 = "Đang tải mods...";
const p11 = "Đang tải Pixelmon...";
const p12 = "Đang tải các thư mục...";

function init(appPath) {
	fsExtra.emptyDirSync(PIXEL_DIR);
	if (!fs.existsSync(PIXEL_DIR)) fs.mkdirSync(PIXEL_DIR);
	if (!fs.existsSync(FILES_PATH)) fs.mkdirSync(FILES_PATH);
	if (!fs.existsSync(GAME_DIR)) fs.mkdirSync(GAME_DIR, { recursive: true });
	if (!fs.existsSync(MOD_PATH)) fs.mkdirSync(MOD_PATH);
	if (!fs.existsSync(ASSETS_PATH)) fs.mkdirSync(ASSETS_PATH);
	if (!fs.existsSync(OBJECTS_PATH)) fs.mkdirSync(OBJECTS_PATH);
	if (!fs.existsSync(INDEXES_PATH)) fs.mkdirSync(INDEXES_PATH);
	if (!fs.existsSync(LOG_CONFIGS_PATH)) fs.mkdirSync(LOG_CONFIGS_PATH);
	if (!fs.existsSync(LIB_PATH)) fs.mkdirSync(LIB_PATH);
	if (!fs.existsSync(META_PATH)) fs.mkdirSync(META_PATH);
	if (!fs.existsSync(BIN_PATH)) fs.mkdirSync(BIN_PATH);
	if (!fs.existsSync(JRE_PATH)) fs.mkdirSync(JRE_PATH);
	if (!fs.existsSync(JRE_PATH_32)) fs.mkdirSync(JRE_PATH_32);
	if (!fs.existsSync(JRE_PATH_64)) fs.mkdirSync(JRE_PATH_64);


	logger.info("Đang Tải File Json Version : " + VERSION_MANIFEST_URL);
	download(VERSION_MANIFEST_URL, VERSION_MANIFEST_PATH).then((m) => {
		for (let version of JSON.parse(m).versions) {
			MC_VERSIONS[version.id] = version.url;
		}
	});

	logger.info("Đang Tải File Json Forge Libarys : " + MC_FORGE_LIBS_URL);
	download(MC_FORGE_LIBS_URL, MC_FORGE_LIBS).then((m) => {
		MC_FORGE_LIBS = JSON.parse(m);
	});

	logger.info("Đang Tải File Server.Dat : " + SERVER_DAT_URL);
	download(SERVER_DAT_URL, SERVER_DAT_PATH);

	logger.info("Đang Tải File Json Custom Zip : " + CUSTOM_URL);
	download(CUSTOM_URL, CUSTOM_URL_PATH).then((m) => {
		CUSTOM_FOLDERS = JSON.parse(m).folders;
		INITIALIZED = true;
	});
}

function progress(msg, size = "") {
	EVENT.reply(global.channels.download.progress, msg, size);
}

function error(msg) {
	EVENT.reply(global.channels.download.error, msg);
}

function finish() {
	EVENT.reply(global.channels.download.finish);
}

function download(url, dest, onSuccess = null, onPipe = null) {
	return new Promise(function (resolve, reject) {
		request({
			url,
			followAllRedirects: true,
			method: "head",
			rejectUnauthorized: false
		})
			.on("response", function (res) {
				var totalSize = res.headers["content-length"];
				var start = Date.now();
				request({
					url,
					followAllRedirects: true,
					rejectUnauthorized: false
				})
					.on("data", function (src) {
						var size = fs.statSync(dest).size + src.byteLength;
						var elapsed = (Date.now() - start) / 1000;
						var bps = size / elapsed;
						var remaining = (totalSize - size) / bps;
						var percent = Math.floor((size * 100) / totalSize);
						if (onPipe) onPipe(size, percent, (bps * 1e-6).toFixed(2), remaining);
					})
					.pipe(fs.createWriteStream(dest))
					.once("close", function () {
						var buffer = fs.readFileSync(dest);
						resolve(buffer);
						if (onSuccess) onSuccess(buffer);
					})
					.once("error", function (err) {
						reject(err);
					});
			})
			.once("error", function (err) {
				reject(err);
			});
	});
}

async function downloadMinecraft(version, isForge, username, e, password, memory) {
	if (!INITIALIZED) logger.info("Lỗi ! Trình Cài Đặt Minecraft Chưa Được Khởi Tạo.");
	else {
		if (!DOWNLOADING) {
			DOWNLOADING = true;
			USERNAME = username;
			EVENT = e;
			MEMORY = memory;
			PASSWORD = password;
			progress("Bắt đầu tải...");
			setTimeout(async () => {
				await downloadJava(version, isForge);
			}, 1500);
			return true;
		} else {
			logger.info("Please wait a bit. You are currently already downloading.");
			return false;
		}
	}
}

async function downloadJava(version, isForge) {
	progress(p9);

	var jreURL, jrePath, jreSize, jreInstallDir, jreHash, jreInstallHash;

	if (process.arch == "x64") {
		jreURL = MC_FORGE_LIBS["LTH"]["java_x64"]["url"];
		jrePath = JRE_64;
		jreInstallDir = JRE_PATH_64;
		jreHash = MC_FORGE_LIBS["jre_64"]["hash"];
		jreSize = MC_FORGE_LIBS["jre_64"]["size"];
		jreInstallHash = MC_FORGE_LIBS["jre_64"]["install_hash"];
	} else {
		jreURL = MC_FORGE_LIBS["LTH"]["java_x32"]["url"];
		jrePath = JRE_32;
		jreInstallDir = JRE_PATH_32;
		jreHash = MC_FORGE_LIBS["jre_32"]["hash"];
		jreSize = MC_FORGE_LIBS["jre_32"]["size"];
		jreInstallHash = MC_FORGE_LIBS["jre_32"]["install_hash"];
	}
	
	// đường dẫn java.exe
	JAVA = path.join(jreInstallDir, "bin", "java.exe");

	if (DEBUG) {
		logger.info(`jreURL: ${jreURL}`);
		logger.info(`jreHash: ${jreHash}`);
		logger.info(`jreInstallHash: ${jreInstallHash}`);
	}

	if (fs.existsSync(JAVA)) {
		await downloadMods(version, isForge);
	} else {
		
		progress(p7);
		await download(jreURL, jrePath, null, function (currentSize, currentPercent, mbps, time) {
			progress(p7, `${currentPercent} % - ${mbps} MB/s - ${Math.floor(time / 60)}m${Math.floor(time % 60)}s`);
		});
		
		if (fs.existsSync(jrePath)) {
			await extract(jrePath, { dir: jreInstallDir });
		}

		setTimeout(async () => {
			await downloadMods(version, isForge);
		}, 2000);

		// var command = [
		// 	"Start-Process",
		// 	"-FilePath",
		// 	`"${jrePath}"`,
		// 	"-ArgumentList",
		// 	`'/s INSTALLDIR="${jreInstallDir}"'`,
		// 	"-Wait",
		// 	"-PassThru"
		// ].join(" ");

		// var powershell = spawn("powershell.exe", [command]);

		// powershell.on("exit", function () {
		// 	progress(p8);
		// 	setTimeout(async () => {
		// 		await downloadMods(version, isForge);
		// 	}, 2000);
		// });
		// tai file java
		
	}
}

async function downloadMods(version, isForge) {
	progress(p10);
	var modsURL = MC_FORGE_LIBS["mods"]["url"];

	logger.info("URL FILE MODS : " + modsURL);

	var modsPath = path.join(FILES_PATH, "mods");

	logger.info("modsPath : " + modsPath);

	var pxmPath = path.join(MOD_PATH, MC_FORGE_LIBS["pixelmon-8.4.2"]["name"]);
	var pxmURL = MC_FORGE_LIBS["pixelmon-8.4.2"]["url"];
	var pxmSize = MC_FORGE_LIBS["pixelmon-8.4.2"]["size"];	
	var pxmHash = MC_FORGE_LIBS["pixelmon-8.4.2"]["hash"];

	await download(modsURL, modsPath, null, function (currentSize, currentPercent, mbps, time) {
		progress(p10, `${currentPercent} % - ${mbps} MB/s - ${Math.floor(time / 60)}m${Math.floor(time % 60)}s`);
	});

	if (fs.existsSync(modsPath)) {
		await extract(modsPath, { dir: MOD_PATH });
	}

	if (!fs.existsSync(pxmPath) || pxmSize != fs.statSync(pxmPath).size || pxmHash != sha1_file.sync(pxmPath)) {
		fs.readdirSync(MOD_PATH).forEach(function (name) {
			if (/^(p|P)(i|I)(x|X)(e|E)(l|L)(m|M)(o|O)(n|N).+/.test(name)) {
				fs.unlinkSync(path.join(MOD_PATH, name));
			}
		});
		progress(p11);
		await download(pxmURL, pxmPath, null, function (currentSize, currentPercent, mbps, time) {
			progress(p11, `${currentPercent} % - ${mbps} MB/s - ${Math.floor(time / 60)}m${Math.floor(time % 60)}s`);
		});
	}

	await downloadVersionMeta(version, isForge);
}

async function downloadVersionMeta(version, isForge) {
	var VERSION_META_URL = MC_VERSIONS[version];
	var VERSION_META_PATH = path.join(META_PATH, `${version}.json`);
	logger.info("Retrieving version " + version + " meta from: " + VERSION_META_URL);
	progress(p1);
	var META = JSON.parse(
		await download(VERSION_META_URL, VERSION_META_PATH, null, function (currentSize, currentPercent, mbps, time) {
			progress(p11, `${currentPercent} % - ${mbps} MB/s - ${Math.floor(time / 60)}m${Math.floor(time % 60)}s`);
		})
	);
	INDEX_VERSION = META["assetIndex"].id;
	await downloadBinaries(META["libraries"], isForge, META["assetIndex"]);
}

async function downloadBinaries(libraries, isForge, assetIndex) {
	logger.info("Downloading binary files...");
	progress(p2);
	await download(
		MC_FORGE_LIBS["native-win"].url,
		NATIVE_WIN_PATH,
		null,
		function (currentSize, currentPercent, mbps, time) {
			progress(p2, `${currentPercent} % - ${mbps} MB/s - ${Math.floor(time / 60)}m${Math.floor(time % 60)}s`);
		}
	);
	await extract(NATIVE_WIN_PATH, { dir: BIN_PATH });
	await downloadForge(libraries, isForge, assetIndex);
}

async function downloadForge(libraries, isForge, assetIndex) {
	logger.info("Binary files extracted, now downloading forge...");

	var forgeServer = MC_FORGE_LIBS["server"];
	var forgeServerPath = forgeServer["path"].split("/");
	var forgeServerURL = forgeServer["url"];

	var forgeClient = MC_FORGE_LIBS["client"];
	var forgeClientPath = forgeClient["path"].split("/");
	var forgeClientURL = forgeClient["url"];

	if (DEBUG) {
		logger.info(`Forge Client path: ${forgeClientPath}`);
		logger.info(`Forge Server path: ${forgeServerPath}`);
	}

	var forgeClientDir = META_PATH;
	for (var i = 0; i < forgeClientPath.length - 1; i++) {
		forgeClientDir = path.join(forgeClientDir, forgeClientPath[i]);
		if (!fs.existsSync(forgeClientDir)) fs.mkdirSync(forgeClientDir);
	}

	var forgeServerDir = LIB_PATH;
	for (var i = 0; i < forgeServerPath.length - 1; i++) {
		forgeServerDir = path.join(forgeServerDir, forgeServerPath[i]);
		if (!fs.existsSync(forgeServerDir)) fs.mkdirSync(forgeServerDir);
	}

	forgeServerPath = path.join(LIB_PATH, ...forgeServerPath);
	forgeClientPath = path.join(META_PATH, ...forgeClientPath);

	await download(forgeServerURL, forgeServerPath, null, function (currentSize, currentPercent, mbps, time) {
		progress(p2, `${currentPercent} % - ${mbps} MB/s - ${Math.floor(time / 60)}m${Math.floor(time % 60)}s`);
	});
	await download(forgeClientURL, forgeClientPath, null, function (currentSize, currentPercent, mbps, time) {
		progress(p2, `${currentPercent} % - ${mbps} MB/s - ${Math.floor(time / 60)}m${Math.floor(time % 60)}s`);
	});

	DUPLICATE_LIBRARIES.add(forgeServerPath);
	DUPLICATE_LIBRARIES.add(forgeClientPath);

	await downloadLibraries(libraries, isForge, assetIndex);
}

/*
 * I don't know why but minecraft libraries has duplicate ones
 */

async function downloadLibraries(libraries, isForge, assetIndex) {
	logger.info("Forge downloaded, now moving to libraries...");

	var LIBS = {
		numLibs: libraries.length + (isForge ? MC_FORGE_LIBS["libraries"].length : 0),
		numLibsVal: 0
	};
	var LIMIT = 20;
	var c = 1;
	asyncjs.eachLimit(
		libraries,
		LIMIT,
		async function (library) {
			var downloads = library["downloads"];

			if ("artifact" in downloads) {
				var artifact = downloads["artifact"];
				var artifactDirPath = artifact["path"].split("/");
				var artifactURL = artifact["url"];
				var artifactSize = artifact["size"];
				var artifactSHA1 = artifact["sha1"];
				var artifactPath = path.join(LIB_PATH, ...artifactDirPath);

				var artifactParentDir = LIB_PATH;
				for (var i = 0; i < artifactDirPath.length - 1; i++) {
					artifactParentDir = path.join(artifactParentDir, artifactDirPath[i]);
					if (!fs.existsSync(artifactParentDir)) fs.mkdirSync(artifactParentDir);
				}

				if (!DUPLICATE_LIBRARIES.has(artifactPath)) {
					DUPLICATE_LIBRARIES.add(artifactPath);
					if (
						!fs.existsSync(artifactPath) ||
						fs.statSync(artifactPath).size != artifactSize ||
						sha1_file.sync(artifactPath) != artifactSHA1
					) {
						logger.info(`Downloading library from: ${artifactURL}`);
						await download(
							artifactURL,
							artifactPath,
							null,
							function (currentSize, currentPercent, mbps, time) {
								progress(
									p2,
									`${currentPercent} % - ${mbps} MB/s - ${Math.floor(time / 60)}m${Math.floor(
										time % 60
									)}s`
								);
							}
						);
					}
				}
			}

			librariesValidate(LIBS, assetIndex);

			if ("classifiers" in downloads) {
				var clsf = downloads["classifiers"];
				if ("natives-windows" in clsf) {
					var clsfNatives = clsf["natives-windows"];
					var clsfDirPath = clsfNatives["path"].split("/");
					var clsfURL = clsfNatives["url"];
					var clsfSize = clsfNatives["size"];
					var clsfSHA1 = clsfNatives["sha1"];
					var clsfPath = path.join(LIB_PATH, ...clsfDirPath);

					var clsfParentDir = LIB_PATH;
					for (var i = 0; i < clsfDirPath.length - 1; i++) {
						clsfParentDir = path.join(clsfParentDir, clsfDirPath[i]);
						if (!fs.existsSync(clsfParentDir)) fs.mkdirSync(clsfParentDir);
					}

					if (!DUPLICATE_LIBRARIES.has(clsfPath)) {
						DUPLICATE_LIBRARIES.add(clsfPath);
						if (
							!fs.existsSync(clsfPath) ||
							fs.statSync(clsfPath).size != clsfSize ||
							sha1_file.sync(clsfPath) != clsfSHA1
						) {
							logger.info(`Downloading library from: ${clsfURL}`);
							await download(clsfURL, clsfPath, null, function (currentSize, currentPercent, mbps, time) {
								progress(
									p2,
									`${currentPercent} % - ${mbps} MB/s - ${Math.floor(time / 60)}m${Math.floor(
										time % 60
									)}s`
								);
							});
						}
					}
				}
			}

			c++;
			if (c % LIMIT == 0) Promise.resolve();
		},
		(err) => {
			if (err) {
				error(p6);
				logger.info(err);
			}
		}
	);

	if (isForge) {
		var librariez = MC_FORGE_LIBS["libraries"];

		asyncjs.eachLimit(
			librariez,
			LIMIT,
			async function (library) {
				var downloads = library["downloads"];
				var artifact = downloads["artifact"];
				var artifactDirPath = artifact["path"].split("/");
				var artifactURL = artifact["url"];
				var artifactSize = artifact["size"];
				var artifactSHA1 = artifact["sha1"];
				var artifactPath = path.join(LIB_PATH, ...artifactDirPath);

				var artifactParentDir = LIB_PATH;
				for (var i = 0; i < artifactDirPath.length - 1; i++) {
					artifactParentDir = path.join(artifactParentDir, artifactDirPath[i]);
					if (!fs.existsSync(artifactParentDir)) fs.mkdirSync(artifactParentDir);
				}

				if (!DUPLICATE_LIBRARIES.has(artifactPath)) {
					DUPLICATE_LIBRARIES.add(artifactPath);
					if (
						!fs.existsSync(artifactPath) ||
						fs.statSync(artifactPath).size != artifactSize ||
						sha1_file.sync(artifactPath) != artifactSHA1
					) {
						logger.info(`Downloading library from: ${artifactURL}`);
						await download(
							artifactURL,
							artifactPath,
							null,
							function (currentSize, currentPercent, mbps, time) {
								progress(
									p2,
									`${currentPercent} % - ${mbps} MB/s - ${Math.floor(time / 60)}m${Math.floor(
										time % 60
									)}s`
								);
							}
						);
					}
				}

				librariesValidate(LIBS, assetIndex);
			},
			(err) => {
				if (err) {
					error(p6);
					logger.info(err.message);
				}
			}
		);
	}
}

/*
 * Same goes for resources, and you have to account for duplicate size as well.
 */
async function downloadAssets(assetIndex) {
	var DUPLICATE_RESOURCES = new Set();

	var indexID = assetIndex["id"];
	var indexURL = assetIndex["url"];
	var indexSHA1 = assetIndex["sha1"];
	var indexPath = path.join(INDEXES_PATH, `${indexID}.json`);

	logger.info(`Downloading version ${indexID} index from: ${indexURL}`);
	progress(p3);
	var objectsResources = JSON.parse(await download(indexURL, indexPath))["objects"];

	var ASSETS = {
		objectsTotalSize: 0,
		indexTotalSize: assetIndex["totalSize"]
	};
	var LIMIT = 50;
	var c = 1;

	asyncjs.eachLimit(
		Object.keys(objectsResources),
		LIMIT,
		async function (objectKey) {
			var object = objectsResources[objectKey];
			var objectHash = object["hash"];
			var objectSize = object["size"];
			var objectDir = path.join(OBJECTS_PATH, `${objectHash[0]}${objectHash[1]}`);
			var objectPath = path.join(objectDir, objectHash);
			var objectURL = urljoin(RESOURCE_URL, `${objectHash[0]}${objectHash[1]}`, objectHash);

			if (!DUPLICATE_RESOURCES.has(objectKey)) {
				DUPLICATE_RESOURCES.add(objectKey);

				if (!fs.existsSync(objectDir)) fs.mkdirSync(objectDir);

				if (
					!fs.existsSync(objectPath) ||
					fs.statSync(objectPath).size != objectSize ||
					sha1_file.sync(objectPath) != objectHash
				) {
					logger.info(`Downloading resource from: ${objectURL}`);
					await download(objectURL, objectPath, null, function (currentSize, currentPercent, mbps, time) {
						progress(
							p3,
							`${currentPercent} % - ${mbps} MB/s - ${Math.floor(time / 60)}m${Math.floor(time % 60)}s`
						);
					});
				}
				assetsValidate(objectPath, ASSETS);
			}
			c++;
			if (c % LIMIT) {
				setTimeout(() => {
					Promise.resolve();
				}, 1000);
			}
		},
		(err) => {
			if (err) {
				error(p6);
				logger.info(err.message);
			}
		}
	);
}

async function downloadCustomFolders() {
	progress(p12);
	for (let folder of CUSTOM_FOLDERS) {
		var folderPath = folder.path.split("/");
		var folderURL = folder.url;
		var folderUnpack = folder.unpack;

		var folderParentDir = GAME_DIR;
		for (var i = 0; i < folderPath.length - 1; i++) {
			folderParentDir = path.join(folderParentDir, folderPath[i]);
			if (!fs.existsSync(folderParentDir)) fs.mkdirSync(folderParentDir);
		}

		var unpackDir;
		if (folderUnpack) unpackDir = folderParentDir;

		folderParentDir = path.join(folderParentDir, folderPath[folderPath.length - 1]);
		logger.info(`Đang Tải Custom File Của Server : ${folderURL}`);
		await download(folderURL, folderParentDir, null, function (currentSize, currentPercent, mbps, time) {
			progress(p12, `${currentPercent} % - ${mbps} MB/s - ${Math.floor(time / 60)}m${Math.floor(time % 60)}s`);
		});

		if (folderUnpack) {
			try {
				await extract(folderParentDir, { dir: unpackDir });
			} catch (err) {
				new Unrar(folderParentDir).extract(unpackDir, null, () => {});
			}
		}
	}
	await downloadConfigurations();
}

async function downloadConfigurations() {
	var logURL = MC_FORGE_LIBS["logging"].url;
	var logName = path.join(LOG_CONFIGS_PATH, MC_FORGE_LIBS["logging"].id);
	LOG_CONFIG = logName;
	logger.info(`Downloading logging configuration file from: ${logURL}`);
	await download(logURL, logName, null, function (currentSize, currentPercent, mbps, time) {
		progress(p12, `${currentPercent} % - ${mbps} MB/s - ${Math.floor(time / 60)}m${Math.floor(time % 60)}s`);
	});
	logger.info("All resources fulfilled, now starting Minecraft...");
	await startMinecraft();
}

function librariesValidate(num, assetIndex) {
	num.numLibsVal++;
	if (DEBUG) {
		logger.info(`Libraries validated: ${num.numLibsVal}`);
		logger.info(`Total libraries: ${num.numLibs}`);
	}
	if (num.numLibs == num.numLibsVal) {
		progress(p4);
		setTimeout(async () => {
			logger.info("All libraries fulfilled, now moving to assets...");
			await downloadAssets(assetIndex);
		}, 1000);
	}
}

function assetsValidate(objectPath, assets, buffer = null) {
	if (!buffer) assets.objectsTotalSize += fs.readFileSync(objectPath).byteLength;
	else assets.objectsTotalSize += buffer.byteLength;
	if (DEBUG) {
		logger.info(`Objects Total Size: ${assets.objectsTotalSize}`);
		logger.info(`Index Total Size: ${assets.indexTotalSize}`);
	}
	if (assets.objectsTotalSize == assets.indexTotalSize) {
		progress(p5);
		setTimeout(async () => {
			logger.info("All assets fulfilled, now moving to custom folders...");
			await downloadCustomFolders();
		}, 1000);
	}
}

async function startMinecraft() {
	setTimeout(() => {
		DOWNLOADING = false;
		finish();
	}, 3000);

	try {
		var LIBRARIES_PATH = Array.from(DUPLICATE_LIBRARIES).join(";");
		var command = [
			"-Command",
			`& "${JAVA}"`,
			`-Xmx${MEMORY}M`,
			`-XX:+UnlockExperimentalVMOptions`,
			`-XX:+UseG1GC`,
			`-XX:G1NewSizePercent=20`,
			`-XX:G1ReservePercent=20`,
			`-XX:MaxGCPauseMillis=50`,
			`-XX:G1HeapRegionSize=32M`,
			"-cp",
			`"${LIBRARIES_PATH}"`,
			`"-Djava.library.path=${BIN_PATH}"`,
			`"${MC_FORGE_LIBS["mainClass"]}"`,
			"--username",
			`"${USERNAME}"`,
			"--version",
			`"1.12.2"`,
			"--gameDir",
			`"${GAME_DIR}"`,
			"--accessToken",
			"0",
			"--assetsDir",
			`"${ASSETS_PATH}"`,
			"--assetIndex",
			`"${INDEX_VERSION}"`,
			"--tweakClass",
			`"net.minecraftforge.fml.common.launcher.FMLTweaker"`
		];

		if (DEBUG) {
			console.log(path.join(PIXEL_DIR, "exec.bat"));
		}

		var minecraft = spawn("powershell.exe", command, { cwd: GAME_DIR });

		minecraft.stdout.on("data", function (data) {
			console.log(data.toString());
		});

		minecraft.stderr.on("data", function (data) {
			console.log(data.toString());
		});

		minecraft.on("exit", function (code) {
			console.log("Minecraft process exited with code: " + code.toString());
			EVENT.reply(global.channels.game.exited, code.toString());
		});
	} catch (err) {
		logger.info(err);
		error(p6);
	}
}

module.exports.downloadMinecraft = downloadMinecraft;
module.exports.isDownloading = function () {
	return DOWNLOADING;
};
module.exports.init = init;
