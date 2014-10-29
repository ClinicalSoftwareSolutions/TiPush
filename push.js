/**
 * Push notification helper library
 * 
 * @class push
 * @uses core
 */
var __FILE__ = "push.js(lib) | ";
var LOGGER = require('logger');
var Cloud = require('ti.cloud');

/**
 * The device token
 * @type String
 */
var DeviceToken = null;

/**
 * Registers the app for push notifications
 */
exports.init = function() {
	LOGGER.debug(__FILE__+"PUSH.init");

	registerDevice(function() {
		LOGGER.debug(__FILE__+"PUSH.init @success");

		// Subscribe everyone to the news channel
		exports.subscribeToChannel('news');
	});
};

/**
 * Subscribes the device to a channel
 _channel = {string} channel name
*/
exports.subscribeToChannel = function (_channel) {
	if(DeviceToken === null) {
		LOGGER.error(__FILE__+"the devices has not be successfully registered. No deviceToken");
		return;
	}

    // Specify the push type as either 'android' for Android or 'ios' for iOS
    Cloud.PushNotifications.subscribeToken({
        device_token: DeviceToken,
        channel: _channel,
        type: Ti.Platform.name == 'android' ? 'android' : 'ios'
    }, function (e) {
        if (e.success) {
            LOGGER.debug(__FILE__+'Subscribed to '+_channel);
        } else {
            LOGGER.debug(__FILE__+'Error:\n' + ((e.error && e.message) || JSON.stringify(e)));
        }
    });
}

/**
 * Subscribes the device to a channel
 _channel = {string} channel name
*/
exports.unsubscribeToChannel = function(_channel) {
	if(DeviceToken === null) {
		LOGGER.error(__FILE__+"the devices has not be successfully registered. No deviceToken");
		return;
	}

    Cloud.PushNotifications.unsubscribeToken({
        device_token: DeviceToken,
        channel: _channel,
    }, function (e) {
        if (e.success) {
            LOGGER.debug(__FILE__+'Unsubscribed from '+_channel);
        } else {
            LOGGER.debug(__FILE__+'Error:\n' + ((e.error && e.message) || JSON.stringify(e)));
        }
    });
}

/**
 * The function to run after a push has been received
 * @param {Object} _data The push data received
 */
function pushRecieved(_data) {
	LOGGER.debug(__FILE__+"ACS.pushReceived");
	LOGGER.debug(__FILE__+JSON.stringify(_data));

	var payload = null;
	var payloadUnified = {};

	if(_data.data) {
		payload = _data.data;
	} else if(_data.payload) {
		payload = JSON.parse(_data.payload);
		payload.alert = payload.android.alert;
	} else {
		LOGGER.debug(__FILE__+"Could not parse pushData");
		return;
	}

	if(OS_ANDROID) {
		payloadUnified.title = payload.android.title;
		payloadUnified.alert = payload.android.alert;
		payloadUnified.icon = payload.android.icon;
		payloadUnified.vibrate = payload.android.vibrate;
		payloadUnified.badge = payload.android.badge;
		payloadUnified.sound = payload.android.sound;
	}

	if(OS_IOS) {
		payloadUnified.title = payload.title;
		payloadUnified.alert = payload.aps.alert;
		payloadUnified.icon = payload.icon;
		payloadUnified.vibrate = payload.vibrate;
		payloadUnified.badge = payload.aps.badge;
		payloadUnified.sound = payload.aps.sound;
	}

	LOGGER.debug(__FILE__+"Unified payload: " + JSON.stringify(payloadUnified));

	var dialog = Ti.UI.createAlertDialog({
		title: payloadUnified.title || "Hospify",
		message: payloadUnified.alert,
		buttonNames: ["OK", "Cancel"],
		cancel: 1
	});

	dialog.show();
};

/**
 * Registers a device for push notifications
 * @param {Function} _callback The function to run after registration is complete
 */
function registerDevice (_callback) {
	LOGGER.debug(__FILE__+"ACS.registerDevice");

	if(OS_IOS) {
		registeriOS(_callback);
	} else if(OS_ANDROID) {
		registerAndroid(_callback);
	}
};

if(OS_ANDROID) {
var CloudPush = require('ti.cloudpush');

	/**
	 * Registers an Android device for push notifications
	 * @param {Function} _callback The function to run after registration is complete
	 * @platform Android
	 */
	var registerAndroid = function(_callback) {
		CloudPush.retrieveDeviceToken({
			success: function(_data) {
				LOGGER.debug(__FILE__+"ACS.registerAndroid @success");
				LOGGER.debug(_data.deviceToken);

				DeviceToken = _data.deviceToken;

				Ti.App.Properties.setString("PUSH_DEVICETOKEN", _data.deviceToken);

				CloudPush.addEventListener('callback', function(evt) {
					pushRecieved(evt);
					//LOGGER.debug(JSON.stringify(evt));
				});

				_callback();
			},
			error: function(_data) {
				LOGGER.debug(__FILE__+"ACS.registerAndroid @error");
				LOGGER.debug(__FILE__+JSON.stringify(_data));
			}
		});
	};
}

if(OS_IOS) {
	/**
	 * Registers an iOS device for push notifications
	 * @param {Function} _callback The function to run after registration is complete
	 * @platform iOS
	 */
	var registeriOS = function(_callback) {
		LOGGER.debug(__FILE__+"PUSH.registeriOS");

		// Check if the device is running iOS 8 or later
		if (parseInt(Ti.Platform.version.split(".")[0], 10) >= 8) {
		    function registerForPush() {
		    	LOGGER.debug(__FILE__+"registerForPush");
		    	
		        Ti.Network.registerForPushNotifications({
		            success: deviceTokenSuccess,
		            error: deviceTokenError,
		            callback: pushRecieved
		        });
		        // Remove event listener once registered for push notifications
		        Ti.App.iOS.removeEventListener('usernotificationsettings', registerForPush); 
		    };
		 
			// Wait for user settings to be registered before registering for push notifications
		    Ti.App.iOS.addEventListener('usernotificationsettings', registerForPush);
		 
		    // Register notification types to use
		    Ti.App.iOS.registerUserNotificationSettings({
			    types: [
		            Ti.App.iOS.USER_NOTIFICATION_TYPE_ALERT,
		            Ti.App.iOS.USER_NOTIFICATION_TYPE_SOUND,
		            Ti.App.iOS.USER_NOTIFICATION_TYPE_BADGE
		        ]
		    });

		} else {
		    // For iOS 7 and earlier
		    Ti.Network.registerForPushNotifications({
		        // Specifies which notifications to receive
		        types: [
		            Ti.Network.NOTIFICATION_TYPE_BADGE,
		            Ti.Network.NOTIFICATION_TYPE_ALERT,
		            Ti.Network.NOTIFICATION_TYPE_SOUND
		        ],
		        success: deviceTokenSuccess,
		        error: deviceTokenError,
		        callback: pushRecieved
		    });
		}

		function deviceTokenSuccess(e) {
			LOGGER.debug(__FILE__+"ACS.registeriOS @success");
			LOGGER.debug(e.deviceToken);

			exports.DeviceToken = e.deviceToken;
			Ti.App.Properties.setString("PUSH_DEVICETOKEN", e.deviceToken);

			_callback();
		};

		function deviceTokenError(e) {
			LOGGER.debug(__FILE__+"ACS.registeriOS @error");
			LOGGER.debug(JSON.stringify(e));
		};
	};
}
