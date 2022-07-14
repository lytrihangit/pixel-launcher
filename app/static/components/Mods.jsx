const React = require("react");
const { ipcRenderer } = window.require("electron");
const remote = window.require("electron").remote;
import { ContentsWrapper, Wrapper, Sidebar, Titlebar, BouncingBalls } from "./SubComponents";
import ReactDOMServer from "react-dom/server";
import { Redirect } from "react-router";
import $ from "jquery";

export default class Mods extends React.Component {
	constructor(props) {
		super(props);  
        
	}

	componentDidMount() {
		if (!window.localStorage.getItem("userdata")) {
			this.setState({
				redirect: "/"   
			});
		}

		$("#titlebar-close").on("click", function (e) {
			var window = remote.getCurrentWindow();
			window.close();
		});

		$("#titlebar-expand").on("click", function (e) {
			var window = remote.getCurrentWindow();
			if (!window.isMaximized()) window.maximize();
			else window.unmaximize();
		});

		$("#titlebar-minimize").on("click", function (e) {
			var window = remote.getCurrentWindow();
			window.minimize();
		});
	}

	render() {
        
		return (
			<ContentsWrapper>
				<Titlebar />
                <div className="index">
					<Sidebar />
                    <div className="index-main">
						<div className="index-mods">
							
                            <div class="grid-container">
                                <div class="grid-item">
                                    <h5>PixelMon</h5>
                                </div>
                                <div class="grid-item">
                                    RLCraft
                                </div>
                                <div class="grid-item">
                                    Jurasic
                                </div>
                            </div>
						</div>
					</div>
                </div>
				
			</ContentsWrapper>  
		);
	}
}
