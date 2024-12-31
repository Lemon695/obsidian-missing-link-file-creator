export class LogUtils {
	static showDebugLog(toMessage: () => string, settings: { debugMode: boolean }) {
		if (settings.debugMode) {
			console.log(toMessage());
		}
	}
}
