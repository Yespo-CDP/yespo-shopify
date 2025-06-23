(function(d,s){
  console.log("EVENT SCRIPT STARTED")

  window.eS = window.eS || function () {
    (window.eS.q = window.eS.q || []).push(arguments);
  };

  var data = JSON.parse(document.getElementById('data').textContent);

  if (!data) {
    return
  }

  console.log('DATA', data)
  console.log('CURRENT PAGE', data.pageTemplate)

  if (data.pageTemplate === '404') {
    window.eS('sendEvent', 'NotFound');
  }

  if (data.pageTemplate === 'index') {
    window.eS('sendEvent', 'MainPage');
  }
})(document, 'script');
