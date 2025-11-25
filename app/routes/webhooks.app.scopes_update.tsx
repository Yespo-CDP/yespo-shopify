import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Action handler for processing Shopify webhook requests related to session updates.
 *
 * Authenticates the incoming webhook request, extracts the payload, session,
 * topic, and shop information. Updates the session's scope with the current
 * scope data received in the payload.
 *
 * @param {ActionFunctionArgs} args - The arguments containing the request.
 * @returns {Promise<Response>} An empty HTTP response indicating success.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
    const { payload, session, topic, shop } = await authenticate.webhook(request);
    console.log(`Received ${topic} webhook for ${shop}`);

    const current = payload.current as string[];
    if (session) {
        await db.session.update({
            where: {
                id: session.id
            },
            data: {
                scope: current.toString(),
            },
        });
    }
    return new Response();
};
