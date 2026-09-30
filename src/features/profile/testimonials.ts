export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  approved: boolean;
};

export const testimonials: Testimonial[] = [];

export function getApprovedTestimonials() {
  const approved = testimonials.filter((testimonial) => testimonial.approved);
  return approved.length >= 2 ? approved : [];
}
