import { layoutFan } from "/lib/fanEngine.js";
import { cardName } from "/lib/spriteMap.js";
import { applyVars, badgeFor, faceVars } from "./cards.js";

export function createHand(element) {
  let cards = [];
  let selected = new Set();
  let signature = "";
  const listeners = {
    reorder() {},
    change() {},
    drop() {},
  };

  function syncPressed() {
    for (const button of element.querySelectorAll(".card")) {
      const on = selected.has(button.dataset.id);
      button.classList.toggle("selected", on);
      button.setAttribute("aria-pressed", String(on));
    }
  }

  function paint() {
    const laid = layoutFan(cards);
    element.replaceChildren();
    for (const card of laid) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "card";
      button.dataset.id = card.id;
      button.style.zIndex = String(card.zIndex);
      button.setAttribute("aria-label", cardName(card));
      button.setAttribute("aria-pressed", String(selected.has(card.id)));
      if (selected.has(card.id)) button.classList.add("selected");
      applyVars(button, {
        "--card-w": `${card.cardWidth}px`,
        "--card-h": `${card.cardHeight}px`,
        "--x": `${card.x}px`,
        "--y": `${card.y}px`,
        "--angle": `${card.angleDeg}deg`,
      });

      const face = document.createElement("span");
      face.className = "card-face";
      face.setAttribute("aria-hidden", "true");
      applyVars(face, faceVars(card, card.cardWidth, card.cardHeight));
      const badge = badgeFor(card);
      if (badge) {
        const mark = document.createElement("span");
        mark.className = "card-badge";
        mark.textContent = badge;
        face.append(mark);
      }
      button.append(face);
      button.addEventListener("pointerdown", (event) => startPointer(event, card.id, button));
      button.addEventListener("keydown", (event) => onKey(event, card.id));
      element.append(button);
    }
  }

  function indexAt(clientX, ignoreId) {
    const buttons = [...element.querySelectorAll(".card")].filter((node) => node.dataset.id !== ignoreId);
    let index = 0;
    for (const button of buttons) {
      const box = button.getBoundingClientRect();
      if (clientX > box.left + box.width / 2) index += 1;
    }
    return index;
  }

  function startPointer(event, id, button) {
    if (event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    const originX = event.clientX;
    const originY = event.clientY;
    let dragged = false;

    const move = (ev) => {
      const dx = ev.clientX - originX;
      const dy = ev.clientY - originY;
      if (!dragged && Math.hypot(dx, dy) <= 8) return;
      dragged = true;
      button.classList.add("is-dragging");
      button.style.zIndex = "80";
      const scale = Number(getComputedStyle(element).getPropertyValue("--hand-scale")) || 1;
      button.style.translate = `${dx / scale}px ${dy / scale}px`;
    };

    const up = (ev) => {
      button.removeEventListener("pointermove", move);
      button.removeEventListener("pointerup", up);
      button.classList.remove("is-dragging");
      button.style.translate = "";
      if (!dragged) {
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        syncPressed();
        listeners.change();
        return;
      }
      const stack = document.elementsFromPoint(ev.clientX, ev.clientY);
      const drop = stack.map((node) => node.closest?.("[data-drop]")).find(Boolean);
      if (drop) {
        listeners.drop(id, drop);
        return;
      }
      const order = cards.map((card) => card.id);
      const from = order.indexOf(id);
      order.splice(from, 1);
      order.splice(indexAt(ev.clientX, id), 0, id);
      listeners.reorder(order);
    };

    button.addEventListener("pointermove", move);
    button.addEventListener("pointerup", up);
  }

  function onKey(event, id) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const order = cards.map((card) => card.id);
    const from = order.indexOf(id);
    const to = event.key === "ArrowLeft" ? Math.max(0, from - 1) : Math.min(order.length - 1, from + 1);
    if (to === from) return;
    order.splice(from, 1);
    order.splice(to, 0, id);
    listeners.reorder(order);
  }

  return {
    element,
    setCards(next) {
      const nextSignature = next.map((card) => card.id).join("|");
      cards = next.slice();
      for (const id of selected) {
        if (!cards.some((card) => card.id === id)) selected.delete(id);
      }
      if (nextSignature !== signature) {
        signature = nextSignature;
        paint();
      } else {
        syncPressed();
      }
    },
    getSelected() {
      return cards.filter((card) => selected.has(card.id));
    },
    clearSelection() {
      selected.clear();
      syncPressed();
    },
    fit(container) {
      const rect = container.getBoundingClientRect();
      const scale = Math.min((rect.width - 12) / 760, (rect.height - 8) / 340, 1.2);
      element.style.setProperty("--hand-scale", String(Math.max(scale, 0.18)));
    },
    onReorder(fn) {
      listeners.reorder = fn;
    },
    onChange(fn) {
      listeners.change = fn;
    },
    onDrop(fn) {
      listeners.drop = fn;
    },
  };
}
