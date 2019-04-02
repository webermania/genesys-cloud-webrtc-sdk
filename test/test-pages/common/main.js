const controller = require('./app-controller');

window.pwt = new window.PurecloudWebTelemetry({
  xhr: {
    apdexT: 500,
    apdexAlert: 0.8
  },
  websockets: {
    apdexT: 5 * 60 * 1000,
    apdexAlert: 0.75
  },
  webrtc: {
    statsInterval: 1000,
    apdex: {
      mediaStart: {
        apdexT: 500,
        apdexAlert: 0.8
      }
    }
  }
});

window.pwt.wrap();

function initApp () {
  const envInput = document.getElementById('environment').value;
  const environmentInfo = window.environments[envInput];
  controller.initialize(environmentInfo, window.conversationsAPI);
}

document.getElementById('start-app-button').addEventListener('click', initApp);
document.getElementById('clear-log').addEventListener('click', controller.clearLog);

// Pre-populate outbound call input with something to test
document.getElementById('outbound-phone-number').value = '*86';
