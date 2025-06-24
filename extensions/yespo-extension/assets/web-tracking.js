function sendPage404Event(eS, pageTemplate) {
  if (pageTemplate === '404') {
    console.log('404 PAGE')
    eS('sendEvent', 'NotFound');
  }
}

function sendMainPageEvent(eS, pageTemplate) {
  if (pageTemplate === 'index') {
    console.log('MAIN PAGE')
    eS('sendEvent', 'MainPage');
  }
}

function sendProductPageEvent(eS, pageTemplate, product) {
  if (pageTemplate === 'product' && !!product) {
    console.log('PRODUCT PAGE')
    eS('sendEvent', 'ProductPage', {
      'ProductPage': {
        'productKey': product.id.toString(),
        'price': product.price.toString(),
        'isInStock': product.available ? 1 : 0
      }});
  }
}

function sendCustomerEvent(eS, customer) {
  if (customer) {
    console.log('CUSTOMER DATA')
    eS('sendEvent', 'CustomerData', {
      'CustomerData': {
        'externalCustomerId': customer.id.toString(),
        'user_email': customer.email,
        'user_name': `${customer.firstName} ${customer.lastName}`,
        'user_phone': customer.phone,
        'user_city': customer.city,
      }
    })
  }
}

function processEvents (d,s) {
  window.eS = window.eS || function () {
    (window.eS.q = window.eS.q || []).push(arguments);
  };

  var data = JSON.parse(d.getElementById('data').textContent);
  if (!data) return

  console.log('data', data)

  sendPage404Event(window.eS, data.pageTemplate);
  sendMainPageEvent(window.eS, data.pageTemplate)
  sendProductPageEvent(window.eS, data.pageTemplate, data.product)
  sendCustomerEvent(window.eS, data.customer)
}
(function(d,s){
  console.log("EVENT SCRIPT STARTED")
  processEvents(d, s)
})(document, 'script');
