const HOST = 'https://bobcat-noted-moose.ngrok-free.app'

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

function getCart() {
  return fetch('/cart.js')
    .then(res => res.json())
    .then(cart => cart);
}
function updateCart() {
  return fetch('/cart/update.js', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ })
  })
    .then(response => {
      return response.json();
    })
    .then(cart => cart)
    .catch((error) => {
      console.error('Error:', error);
    });
}

async function getCartToken() {
  const cart = await getCart()

  if (!cart.token.includes('?key')) {
    const updatedCart = await updateCart()
    console.log('UPDATE CART', updatedCart)
    return updatedCart.token
  }

  console.log('CART', cart)
  return cart.token
}

function getCookieValue(cookie, name) {
  const match = cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

async function sendTrackingData(domain, cookie) {
  const sc = getCookieValue(cookie, 'sc')
  const cartToken = await getCartToken()
  const token = cartToken.split('?')

  fetch(`${HOST}/public/event-data`, {
    method: 'POST',
    body: JSON.stringify({
      shop: domain,
      sc,
      cartToken: token[0]
    }),
  })
    .then(res => res.json())
    .then(data => {
      console.log('✅ Tracking sent:', data);
    })
    .catch(err => {
      console.error('❌ Tracking failed:', err);
    });
}

async function processEvents (d,s) {
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
  await sendTrackingData(data.domain, d.cookie)
}
(async function(d,s){
  console.log("EVENT SCRIPT STARTED")
  await processEvents(d, s)
})(document, 'script');
