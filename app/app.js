const { downloadMinecraft, init } = require("./static/js/installer");
const { app, ipcMain, BrowserWindow, Notification, dialog, ipcRenderer } = require("electron");
const { autoUpdater } = require("electron-updater");
const url = require("url");
const path = require("path");
const hwid = require(`node-hwid`)

var mainWin;

global.channels = {
	game: {
		mods: "game-mods",
		exited: "game-exited"
	},
	titlebar: {
		close: "close-window-titlebar",
		minimize: "minize-window-titlebar",
		expand: "expand-window-titlebar"
	},
	download: {
		request: "download-request",
		response: "download-response",
		finish: "download-finish",
		progress: "download-progress",
		error: "download-error"
	},
	data: {
		save: "data-save"
	},
	window: {
		resize: "window-resize",
		notification: "window-notification"
	},
    update: {
        available: "update-available",
        unavailable: "update-unavailable"
    }
};

const startUrl =
	process.env.ELECTRON_START_URL ||
	url.format({
		pathname: path.join(__dirname, "./index.html"),
		protocol: "file:",
		slashes: true
	});	

function mainWindow() {
	mainWin = new BrowserWindow({
		width: 720,
		height: 720,
		minWidth: 720,
		minHeight: 720,
		title: "PixelMC Launcher",
		frame: false,
		icon: path.join(__dirname, "/static/media/favicon.ico"),
		webPreferences: {
			nodeIntegration: true,
			enableRemoteModule: true,
			preload: path.join(__dirname, "/static/js/preload.js")
		}
	});
	mainWin.setMinimumSize(1280, 720);
	mainWin.removeMenu();
	mainWin.loadURL(startUrl);
  	//mainWin.webContents.openDevTools();
	mainWin.on("closed", function () {
		mainWin = null;
	});
    mainWin.on("ready-to-show", () => {
        autoUpdater.checkForUpdates();
        mainWin.webContents.executeJavaScript(`sessionStorage.setItem("updateAvailable", false);`).then();
        mainWin.webContents.send(global.channels.update.unavailable);
    });
	
    autoUpdater.on("update-available", () => {
        mainWin.webContents.executeJavaScript(`sessionStorage.setItem("updateAvailable", true);`).then();
        mainWin.webContents.send(global.channels.update.available);
    });

    autoUpdater.on("update-not-available", () => {
        mainWin.webContents.executeJavaScript(`sessionStorage.setItem("updateAvailable", false);`).then();
        mainWin.webContents.send(global.channels.update.unavailable);
    });

    autoUpdater.on("update-downloaded", () => {
        autoUpdater.quitAndInstall();
    });

	mainWin.show();
}

app.on("ready", () => {

	var sys = require('util')
	var exec = require('child_process').exec;
	function puts(error, stdout, stderr) {
		console.log(stdout)
	}

	exec("wmic CPU get ProcessorId", puts);
	exec("wmic DISKDRIVE get SerialNumber", puts);

	if(process.platform == "win32") {
		app.setAppUserModelId("PixelMC");
	}
	mainWindow();
	init(app.getAppPath());
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	if (mainWin == null) {
		mainWindow();
	}
});

function showNotification(msg) {
	const notification = {
		title: "PixelMc Launcher",
		body: msg,
		icon: "app/static/media/faviconx256.ico"
	};
	new Notification(notification).show();
}

dialog.showErrorBox = function (title, content) {
	console.log(`${title}\n${content}`);
};

ipcMain.on(global.channels.download.request, function (e, args) {
	mainWin.webContents.executeJavaScript('localStorage.getItem("userdata");', true).then((result) => {
		var user = JSON.parse(result);
		var username = user.username;
		var password = user.password;
		downloadMinecraft("1.12.2", true, username, e, password, args.memory).then((downloaded) => {
			e.reply(global.channels.download.response, downloaded);
		});
	});
});

ipcMain.on(global.channels.data.save, function (e, args) {
	var data = JSON.stringify(JSON.stringify(args));
	var script = 'localStorage.setItem("userdata",' + data + ");";
	mainWin.webContents.executeJavaScript(script, true).then((result) => {
		console.log(result);
	});
});

ipcMain.on(global.channels.window.resize, function (e, args) {
	var data = JSON.parse(args);
	switch (data.type) {
		case "min":
			mainWin.setMinimumSize(data.width, data.height);
			break;
		case "max":
			mainWin.setMaximumSize(data.width, data.height);
			break;
		default:
			break;
	}
	mainWin.setSize(data.width, data.height);
});


ipcMain.on(global.channels.window.notification, function (e, msg) {
	showNotification(msg);
});

try {
	require("electron-reloader")(module);
} catch (_) {}
