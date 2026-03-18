export const getAuthCallbackScript = (host: string) => {
  return `function yespoAppAuthCallback() {
    return new Promise((resolve, reject) => {
      try {
      const customer = (window.YESPO_APP_CONFIG && window.YESPO_APP_CONFIG.customer) || null;
      const shop = (window.YESPO_APP_CONFIG && window.YESPO_APP_CONFIG.shop) || '';
      if (!customer) {
        return;
      }

      const payload = {
        externalCustomerId: customer.id.toString(),
        email: customer.email,
        phone: customer.phone || null,
        shop: shop
     };

      fetch("${host}/public/app-inbox/get-token", {
          method: "POST",
          body: JSON.stringify(payload),
          keepalive: true
        })
        .then(res => res.json())
       .then(data => resolve(data.token || ''))
      .catch(err => resolve(''));
     } catch (e) {
        console.error("[AuthCallback] Exception:", e);
       return;
    }
   })
  }`
}
