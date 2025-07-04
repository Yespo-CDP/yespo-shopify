class EventTracker {
  constructor(document, scriptTagName = 'script') {
    this.document = document;
    this.scriptTagName = scriptTagName;
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
      return updatedCart?.token || null;
    }

    return decoded;
  }

  sendPage404Event() {
    try {
      if (this.data.pageTemplate === '404') {
        window.eS('sendEvent', 'NotFound');
      }
    } catch (e) {
      console.error('Failed send 404 page event')
    }
  }

  sendMainPageEvent() {
   try {
     if (this.data.pageTemplate === 'index') {
       window.eS('sendEvent', 'MainPage');
     }
   } catch (e) {
     console.error('Failed send main page event')
   }
  }

  sendProductPageEvent() {
    try {
      const product = this.data.product;
      if (this.data.pageTemplate === 'product' && product) {
        window.eS('sendEvent', 'ProductPage', {
          ProductPage: {
            productKey: product.id.toString(),
            price: product.price.toString(),
            isInStock: product.available ? 1 : 0
          }
        });
      }
    } catch (e) {
      console.error('Failed send product page event')
    }
  }

  sendCustomerEvent() {
    try {
      const customer = this.data.customer;
      if (customer) {
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
    } catch (e) {
      console.error("Failed send customer data event")
    }
  }

  async sendTrackingData() {
    const sc = this.getCookieValue('sc');
    const cartTokenRaw = await this.getCartToken();
    const token = cartTokenRaw ? cartTokenRaw.split('?')[0] : null;
    const customer = this.data.customer;

    if (!this.data.host) {
      return
    }

    try {
      const res = await fetch(`${this.data.host}/public/event-data`, {
        method: 'POST',
        body: JSON.stringify({
          shop: this.data.domain,
          sc,
          cartToken: token,
          customer
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

    console.log('>>>>>>', this.data)

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
