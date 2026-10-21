/** Static marketing copy. Edit freely; nothing here touches the database. */

/** Sample reviews: replace with real ones from customers before launch. */
export const TESTIMONIALS = [
  {
    name: "Priya S.",
    area: "Regular since March",
    text: "Ordered at 4 PM, eggs were at my door by 7. The price is honest and the trays arrive without a single cracked egg.",
  },
  {
    name: "Rahul M.",
    area: "Orders twice a week",
    text: "We run a small café and the daily price makes planning easy. Delivery windows are always kept.",
  },
  {
    name: "Anita K.",
    area: "First order last month",
    text: "Noticeably fresher than the supermarket. The tracking page told me exactly when the rider was on the way.",
  },
  {
    name: "Suresh P.",
    area: "Family of five",
    text: "Two trays a week, free delivery, and I pay the rider by UPI. Saves me a trip to the market every Sunday.",
  },
  {
    name: "Meera J.",
    area: "Home baker",
    text: "Yolks are deep orange and the shells are clean. My cakes rise better than with the packet eggs I used before.",
  },
] as const;

export const FAQ = [
  {
    q: "How fresh are the eggs?",
    a: "Trays are picked up from the farm in the morning and delivered the same evening. We never hold stock overnight unless an order is cancelled.",
  },
  {
    q: "Why does the price change?",
    a: "Egg prices move with the farm rate. We pass that rate on with a small fixed margin, so some days are cheaper than others. Your price is locked the moment you order.",
  },
  {
    q: "Can I cancel?",
    a: "Yes, free of charge, until we start packing your order. Open the tracking page and tap Cancel.",
  },
  {
    q: "What if an egg arrives broken?",
    a: "Report it from the tracking page after delivery. We replace broken eggs on your next order or refund them.",
  },
  {
    q: "How do I pay?",
    a: "Cash or UPI when the rider arrives. There is no online prepayment.",
  },
] as const;
