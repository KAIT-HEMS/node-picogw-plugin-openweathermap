const fs = require('fs');
const http = require('http');

const REQ_TIMEOUT = 30*1000;
const OPENWEATHERMAP_BASE_URL = 'http://api.openweathermap.org/data/2.5/';

let pi;
let log = console.log; // eslint-disable-line no-unused-vars


module.exports = {
    init: init,
    onCall: onProcCall,
};

/**
 * Initialize plugin
 * @param {object} pluginInterface The interface of picogw plugin
 */
function init(pluginInterface) {
    pi = pluginInterface;
    log = pi.log;

    pi.on('SettingsUpdated', (newSettings) =>{
        for (let k in newSettings) {
            if (typeof newSettings[k] == 'string') {
                newSettings[k] = newSettings[k].trim();
            }
        }
    });
}

/**
 * onCall handler of plugin
 * @param {string} method Caller method, accept GET only.
 * @param {string} path Plugin URL path
 * @param {object} args parameters of this call
 * @return {object} Returns a Promise object or object containing the result
 */
function onProcCall(method, path, args) {
    let re = {
        weather: {},
        forecast: {},
    };
    if (args && args.option === 'true') {
        re.weather.option = {doc: {short: 'Current weather'}};
        re.forecast.option = {doc: {short: '5 day / 3 hour weather forecast'}};
    }

    switch (method) {
    case 'GET':
        if (path == '') {
            return re;
        }

        return new Promise((ac, rj)=>{
            let API_URL;
            try {
                let settings;
                try {
                    settings = JSON.parse(fs.readFileSync(
                        pi.getpath() + 'settings.json').toString());
                    if (typeof settings.APPID != 'string') throw new Error({});
                } catch (e) {
                    rj({error: 'No openweathermap API key is specified.\nYou can obtain your own api key by creating OpenWeatherMap account on https://home.openweathermap.org/users/sign_up'}); // eslint-disable-line max-len
                    return;
                } ;
                settings = Object.assign(settings, args);

                let settingsFlat = '';
                for (let key in settings) {
                    if (settings[key] == null || settings[key]=='') {
                        delete settings[key];
                        continue;
                    }
                    settingsFlat += '&'+key+'='+settings[key];
                }

                API_URL = OPENWEATHERMAP_BASE_URL + path + '?'
                    + settingsFlat.slice(1); // remove first &

                if (settings.q == null &&
                    (settings.lat == null || settings.lon == null)) {
                    rj({error: 'No position data specified.', api: API_URL});
                }


                http.get(API_URL, function(res) {
                    res.setEncoding('utf8');
                    let repBody = '';
                    res.on('data', function(str) {
                        repBody += str;
                    });
                    res.on('end', function() {
                        try {
                            ac(JSON.parse(repBody));
                        } catch (e) {
                            rj({error: e.toString(), api: API_URL});
                        };
                    });
                })
                    .setTimeout(REQ_TIMEOUT)
                    .on('timeout', function() {
                        rj({error: 'Request time out', api: API_URL});
                    }).on('error', function(e) {
                        rj({error: e.message, api: API_URL});
                    });
            } catch (e) {
                rj({error: e.toString(), api: API_URL});
            };
        });
    case 'POST':
    case 'PUT':
    case 'DELETE':
    default:
        return {error: `The specified method ${method} is not implemented in admin plugin.`}; // eslint-disable-line max-len
    }
}
