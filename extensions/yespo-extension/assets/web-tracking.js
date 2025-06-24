function page404(eS, pageTemplate) {
  if (pageTemplate === '404') {
    console.log('404 PAGE')
    eS('sendEvent', 'NotFound');
  }
}

function mainPage(eS, pageTemplate) {
  if (pageTemplate === 'index') {
    console.log('MAIN PAGE')
    eS('sendEvent', 'MainPage');
  }
}

function productPage(eS, pageTemplate, product) {
  if (pageTemplate === 'product' && !!product) {
    console.log('PRODUCT PAGE')
    window.eS('sendEvent', 'ProductPage', {
      'ProductPage': {
        'productKey': product.id.toString(),
        'price': product.price.toString(),
        'isInStock': product.available ? 1 : 0
      }});
  }
}

function processEvents (d,s) {
  window.eS = window.eS || function () {
    (window.eS.q = window.eS.q || []).push(arguments);
  };

  var data = JSON.parse(d.getElementById('data').textContent);
  if (!data) return

  page404(window.eS, data.pageTemplate);
  mainPage(window.eS, data.pageTemplate)
  productPage(window.eS, data.pageTemplate, data.product)
}
(function(d,s){
  console.log("EVENT SCRIPT STARTED")
  processEvents(document, 'script')
})(document, 'script');
