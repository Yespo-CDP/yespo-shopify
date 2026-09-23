import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Yespo for Shopify</h1>
        <p className={styles.text}>
          Marketing automation for ecommerce: sync customers, orders, and
          products, track storefront events, and send web push from Yespo.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Data sync</strong>. Keep customers, orders, products, and
            market prices in Yespo up to date from Shopify.
          </li>
          <li>
            <strong>Web tracking</strong>. Send storefront events so Yespo can
            analyse visitor behaviour and personalise campaigns.
          </li>
          <li>
            <strong>Web push</strong>. Inject Yespo scripts and the service
            worker so shoppers can subscribe to push notifications.
          </li>
        </ul>
      </div>
    </div>
  );
}
