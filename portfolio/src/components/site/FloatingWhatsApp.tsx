"use client";
/** Floating WhatsApp button: appears after the hero, hides while the contact section is on screen. */
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { WhatsAppIcon } from "@/components/shared/icons";

export function FloatingWhatsApp({ href }: { href: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let contactVisible = false;
    const contact = document.getElementById("contact");
    const io = contact
      ? new IntersectionObserver(([e]) => {
          contactVisible = !!e?.isIntersecting;
          update();
        })
      : null;
    if (contact) io!.observe(contact);
    function update() {
      setShow(window.scrollY > window.innerHeight * 0.8 && !contactVisible);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", update);
    };
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat on WhatsApp"
          className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-[#06210f] shadow-[0_10px_40px_-10px_rgba(37,211,102,0.6)] transition-transform hover:scale-105 sm:bottom-8 sm:right-8"
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
        >
          <WhatsAppIcon className="h-7 w-7" />
        </motion.a>
      )}
    </AnimatePresence>
  );
}
