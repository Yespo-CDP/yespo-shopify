class EventTracker {
  constructor(document, scriptTagName = 'script') {
    this.document = document;
    this.scriptTagName = scriptTagName;
    this.HOST = 'https://bobcat-noted-moose.ngrok-free.app';
    this.cookie = document.cookie;

    window.eS = window.eS || function () {
      (window.eS.q = window.eS.q || []).push(arguments);
    };

    this.data = this.getPageData();
  }

  getPageData() {
    try {
      const scriptTag = this.document.getElementById('data');
      return scriptTag ? JSON.parse(scriptTag.textContent) : null;
    } catch (error) {
      console.error('Error parsing JSON from #data script tag:', error);
      return null;
    }
  }

  getCookieValue(name) {
    const match = this.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return match ? match[2] : "";
  }

  //Create empty cart
  async updateCart() {
    try {
      const res = await fetch('/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        keepalive: true
      });
      return await res.json();
    } catch (error) {
      console.error('Error updating cart:', error);
      return null;
    }
  }

  async getCartToken() {
    const raw = this.getCookieValue('cart');

    const decoded = decodeURIComponent(raw);
    if (!decoded.includes('?key')) {
      const updatedCart = await this.updateCart();
      console.log('UPDATE CART', updatedCart);
      return updatedCart?.token || null;
    }

    console.log('CART', decoded);
    return decoded;
  }

  sendPage404Event() {
    if (this.data.pageTemplate === '404') {
      console.log('404 PAGE');
      window.eS('sendEvent', 'NotFound');
    }
  }

  sendMainPageEvent() {
    if (this.data.pageTemplate === 'index') {
      console.log('MAIN PAGE');
      window.eS('sendEvent', 'MainPage');
    }
  }

  sendProductPageEvent() {
    const product = this.data.product;
    if (this.data.pageTemplate === 'product' && product) {
      console.log('PRODUCT PAGE');
      window.eS('sendEvent', 'ProductPage', {
        ProductPage: {
          productKey: product.id.toString(),
          price: product.price.toString(),
          isInStock: product.available ? 1 : 0
        }
      });
    }
  }

  sendCustomerEvent() {
    const customer = this.data.customer;
    if (customer) {
      console.log('CUSTOMER DATA');
      let customerData = {
        externalCustomerId: customer.id.toString(),
        user_email: customer.email,
      };

      if (customer.firstName || customer.lastName) {
        customerData.user_name = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
      }

      if (customer.phone) {
        customerData.user_phone = customer.phone;
      }

      window.eS('sendEvent', 'CustomerData', {
        CustomerData: customerData
      });
    }
  }

  async sendTrackingData() {
    const sc = this.getCookieValue('sc');
    const cartTokenRaw = await this.getCartToken();
    const token = cartTokenRaw ? cartTokenRaw.split('?')[0] : null;

    try {
      const res = await fetch(`${this.HOST}/public/event-data`, {
        method: 'POST',
        body: JSON.stringify({
          shop: this.data.domain,
          sc,
          cartToken: token
        }),
        keepalive: true
      });
      console.log('✅ Tracking sent:', res);
    } catch (error) {
      console.error('❌ Tracking failed:', error);
    }
  }

  async run() {
    if (!this.data) return;

    this.sendPage404Event();
    this.sendMainPageEvent();
    this.sendProductPageEvent();
    this.sendCustomerEvent();
    await this.sendTrackingData();
  }
}

// 👇 Execute the tracker
(async () => {
  console.log("EVENT SCRIPT STARTED");
  const tracker = new EventTracker(document);
  await tracker.run();
})();
