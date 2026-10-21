/** Browser side of Razorpay: load Checkout, open it, and report how it ended. */

type RzpResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RzpInstance = { open: () => void; on: (event: string, cb: (r: { error?: { description?: string; reason?: string } }) => void) => void };
type RzpConstructor = new (options: Record<string, unknown>) => RzpInstance;

declare global {
  interface Window {
    Razorpay?: RzpConstructor;
  }
}

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<RzpConstructor> | null = null;

export function loadRazorpay(): Promise<RzpConstructor> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (!loading) {
    loading = new Promise<RzpConstructor>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT;
      s.async = true;
      s.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Razorpay didn't load")));
      s.onerror = () => {
        loading = null;
        s.remove();
        reject(new Error("Razorpay didn't load"));
      };
      document.body.appendChild(s);
    });
  }
  return loading;
}

export type PayOutcome =
  | { status: "paid"; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }
  | { status: "failed"; reason: string };

/**
 * Open Razorpay Checkout for an order created on the server. Resolves once:
 * paid (with the signature to verify on the server), or failed/closed. When a
 * payment attempt fails, Razorpay lets the customer retry inside the same
 * window, so a failure only ends things once they close it.
 */
export async function payWithRazorpay(o: {
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  prefill: { name: string; contact: string; email: string };
  description: string;
}): Promise<PayOutcome> {
  const Razorpay = await loadRazorpay();
  return new Promise<PayOutcome>((resolve) => {
    let lastError = "";
    let done = false;
    const end = (r: PayOutcome) => {
      if (done) return;
      done = true;
      resolve(r);
    };
    const rzp = new Razorpay({
      key: o.keyId,
      order_id: o.razorpayOrderId,
      amount: o.amount,
      currency: "INR",
      name: "AndeWala",
      description: o.description,
      image: `${window.location.origin}/icons/icon-192.png`,
      prefill: o.prefill,
      theme: { color: "#1f4d3f" },
      retry: { enabled: true },
      handler: (r: RzpResponse) =>
        end({ status: "paid", razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature }),
      modal: {
        confirm_close: true,
        ondismiss: () => end({ status: "failed", reason: lastError || "You closed the payment window before paying." }),
      },
    });
    rzp.on("payment.failed", (r) => {
      lastError = r.error?.description || "The payment was declined.";
    });
    rzp.open();
  });
}
