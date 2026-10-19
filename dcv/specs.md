---
name: Flexible table spec
overview: "Living spec for a generic shared table: a public window shares its frame and contents, each player keeps their own scroll, card faces belong to entities, and windows and entities can be converted into each other."
todos:
  - id: resolve-drag
    content: Decide whether dragging a referenced entity into another window removes it from the source or keeps both views.
    status: completed
  - id: continue-spec
    content: Keep collecting spec decisions before any UX rework code.
    status: pending
isProject: false
---

# Flexible table spec

Specs only. No implementation yet. The Rec Room styleguide stays the visual system. Work stays on `feature/ux-rework`.

## Locked so far

- The table is a place to organize decks, hands, piles, and chat. It does not enforce a card game's rules.
- A public window shares its position, size, and contents. Dragging or resizing it moves it for every player. Scroll and zoom are each player's own, on a public window and on a private one. One player scrolling or zooming does not move anyone else's view or change the shared frame. A new window opens at the default zoom. Zoom is saved with that player's scroll and restored when they rejoin.
- Every window sits on one desktop. Each player pans that desktop on their own. Public window positions stay shared in table space, so one player can pan over to a window without moving it for anyone else. That pan is saved and restored when they rejoin. The player list stays fixed on the screen and does not pan with the desktop. A small map of the desktop sits in the chrome beside the player list. It shows each window that player is allowed to see: every public window, their own private windows, and private windows they are invited to. It does not show anyone else's private windows. Clicking a window there pans only that player's desktop so the window is in view, and highlights it briefly on their screen. The click does not move or resize the window. Moving and resizing still happen on the desktop.
- Face-up and face-down belong to the entity (deck, hand, or pile). A private window may show the owner their own hidden cards. Making a window public does not reveal faces that entity keeps hidden.
- The same entity can be referenced from more than one window. A control on the entity, Open in a new window, keeps the original in place and opens a private window on those same cards. Dragging an entity onto a window asks whether to move that view or also show it there. Moving a view takes it out of the source window. Also showing it leaves the source in place. A move inside a public window is seen by everyone. Each view can use its own drawing (fan, row, or grid). Copy is separate and makes a new deck.
- Any seated player can edit a public window.
- The player who switches a window to private is the one who controls that view. Everyone else who had it open sees it cleared, with that player's name. The owner can invite players when hiding it, or later with an invite link.
- A window can become an entity, and an entity can become a window. Converting a window groups everything inside it into one new entity. You choose which window receives that group. Everyone sees the original window close and the grouped entity land there.
- An invited player can move, resize, and drag inside a private window the same as the owner.
- A card leaves a hand only when the player who holds that hand moves it. Any seated player can move cards in a deck or pile on the public table.
- Joining an empty table shows one public table window, a shared chat on that table, and a private window for each player with their own hand. Hands start empty.
- Moving one card at a time is the basic action. Shuffle, flip, deal, cut, and similar shortcuts sit on top of that. Any seated player can use those shortcuts on a public deck.
- The player who holds a hand is the one who flips that hand. Any seated player can flip a deck or pile on the public table.
- The first shortcuts are shuffle, flip, deal, draw one, cut, and flip the top card. Any seated player can use them on a public deck.
- The first player to pick up a card locks it until they drop it. Another player cannot pick up that same card while it is held.
- The first deck a player can add is a standard deck. Adding it asks: 52 cards, ace through king in four suits, or that deck plus two jokers. The two jokers are different cards: one red and one black. Any seated player can add a deck.
- Deal asks for a count and for which hands. Each picked hand receives that many cards from the top, in the order the hands were picked. If the deck runs out, the deal stops.
- Copy asks each time: duplicate the cards the deck has now, in the same order and facing, or make a fresh shuffled deck of the same kind. A 52 stays a 52. A 54 stays a 54. The fresh deck does not ask about jokers again. The original deck is unchanged either way.
- A pile, a single loose card, and a grouped entity can be dragged between windows, along with decks and hands. The shared chat stays on the public table in this first spec.
- Dropping a card on another loose card makes a pile. Dropping a card on a pile adds it. A pile can be shuffled and flipped. Deal and cut stay on decks.
- Cut uses a slider to choose the split. The cards above that point move to the bottom and keep their order.
- Converting a grouped entity back into a window follows the parent it sat in. A group in a public window opens as a public window. A group in a private window opens as a private window for the same people. Everyone who can see the parent sees the group open.
- A loose card or a pile dropped on a deck joins that deck, on top.
- Flip top lifts the top card off the deck and sets it beside the deck as a loose face-up card. That shortcut always sets the loose card face-up, including when the deck is face-down. The new top card of the deck is left as it was.
- Closing a window removes entities that were shown only in that window. An entity that still has another view stays in that other view.
- Draw one moves the top card of a deck into the hand of the player who used it. An empty deck does nothing.
- Right-click on empty desktop opens that player's menu. On a touch screen, long-press on empty desktop does the same. The menu stays only on that player's screen and holds New window, New deck, and New dummy. The player list and the map do not hold these controls. Any seated player can use the menu. A new deck and a new dummy still ask the questions already decided. Shuffle, flip, deal, and the other entity actions stay on the entity.
- Right-click or long-press on a card, hand, deck, pile, or window opens a context menu for that object, only on that player's screen. The empty-desktop menu is unchanged and still only offers New window, New deck, and New dummy. The object menu lists only actions that player is already allowed to take on that object. It grants no new authority. If they can take no action, no menu appears. It shows Delete only when that player is allowed to delete that entity.
- A new empty window starts private, owned by the player who created it. They can drag entities into it and later switch it to public.
- Adding a deck asks which window receives it. A deck placed in a public window is visible to everyone. A deck placed in a private window is visible only to the people who can see that window.
- A view can be drawn as a fan, a row, or a grid. A tight stack is not in the first spec. The drawing belongs to that view, so a public window shows one drawing to everyone, and another window can draw the same entity differently.
- A new hand, deck, pile, or loose card starts as a row. Fan and grid are chosen afterward on that view.
- Delete removes that entity from every window. Every view of it disappears, and its cards are gone.
- Delete follows the same authority as moving cards. Only the holder can delete their own hand. Another player cannot. Any seated player can delete a dummy's hand. Any seated player who can see a deck, pile, loose card, or grouped entity can delete that whole entity. While a player is away, others still cannot delete that hand. Assuming ownership makes the taker the holder, and then they can delete it. A card still inside a hand, deck, or pile is not separately deletable by this decision. Confirmation and the ten-second undo stay as they are.
- A player who leaves or disconnects keeps their hand and private windows. Rejoining with the same name shows those windows again. Other players still cannot see the private windows.
- While that player is gone, a seated player can assume ownership of their hand and their private windows. Public decks they placed stay where they are. When they rejoin, anything not taken is still theirs, and the control goes away.
- The original public table stays public. It cannot be closed, deleted, or converted into an entity. Players can still move it, resize it, and change what is inside it.
- Delete, and closing a window that will remove entities, always ask first. The confirmation names what will be removed.
- A player can select several cards in the same hand, deck, or pile and drag them together. They land in that same order. The drag locks every selected card. If one of them is already locked by another player, the drag does not start.
- A chat log, a grid, or another entity can scroll inside itself. That inner scroll is local to each player. It does not move the window or anyone else's place in that log or grid.
- Each player can turn on a pointer from a toggle on that window. It stays on until they turn it off. While it is on, the window shows their name and a distinct color wherever they point. Several pointers can show at once. The pointer does not move cards or windows.
- A selection is visible to everyone who can see that window. The same cards are highlighted for all of them.
- Dragging a card to a new spot in the same hand, deck, or pile changes that entity's order. Every view shows the new order.

- Public windows also share which one is in front. Bringing a public window forward brings it forward for everyone.
- The table is saved. Leaving and a server restart both keep the windows, cards, chat, and each player's scroll in each window. A player who rejoins with the same name returns to the scroll they last left. A new arrival, or a window that player has not scrolled, opens at the default spot.
- A player is recognized by the name they type. If that name belongs to someone who is gone, the arrival gets that player's remaining private windows and hand.
- If someone has already assumed ownership of that hand and those private windows, the name is free. The arrival gets a new empty hand and a new private window. The player who took ownership keeps what they took.
- After that transfer, the hand shows the new owner's name. The private windows are theirs. People who were already invited stay invited.
- A name that someone seated is already using is refused. Two players cannot sit under the same name at the same time.
- A private window shared with invited players keeps its contents in sync, including card moves. Each invited player places, sizes, and scrolls that window on their own screen. A pointer marks a spot in the contents, so the others see it on the same item even when their window sits somewhere else.
- A grouped entity shows a small preview of what is inside, packed into one object. Opening it turns that group back into a window.
- A window or group starts with a default name, such as "Window 2" or the hand's owner. Anyone who can edit that window can rename it. A public name is seen by everyone. A private name is seen by the people invited.
- Inside a window, entities sit on a free canvas. They can overlap and be dropped anywhere. Those positions are part of the contents, so everyone who shares the contents sees the same arrangement. A window scrolls when the canvas is larger than the frame.
- Dropping an entity, or clicking it, brings it to the front. That front-to-back order is part of the contents, so everyone who shares the window sees the same order.
- Fan, row, and grid are chosen from a control on that hand, deck, or pile. Anyone who can edit the window can change it. A public window then shows the new drawing to everyone. Another window showing the same entity is unchanged.
- After a confirmed delete, a close that removes entities, or a move that hides the last public view, the player who did it sees Undo for about ten seconds. It restores only that latest action. Another action replaces it. Using it brings back what was removed, and the other players see it return. Deal, Draw one, Shuffle, and Cut are not undone.
- A new deck starts face-down. Each hand starts face-down. The owner's private window shows that hand's faces. On a public window, that same hand shows backs to everyone, including the owner.
- A new pile faces the same way as the loose card it was dropped on. Dropping a card onto a face-up card starts a face-up pile. Dropping onto a face-down card starts a face-down pile.

- Moving the last public view of an entity into a private window is allowed. You must confirm first, because other players will lose sight of it. Undo can restore that public view for about ten seconds.
- Cards enter a hand when that hand's owner drags them in, or when Deal or Draw one puts them there. Another player cannot drop a card onto your hand. Draw one still gives the card to the player who used it. Deal can still give cards to the hands that were picked.
- Dragging one card from a face-down hand onto an empty canvas asks: play it face-up, or set it down face-down. Face-up shows that card to everyone who can see the window. Dragging one card from a face-down deck or pile onto empty canvas asks the same prompt. The prompt applies only when the source is face-down. A card dragged from a face-up deck or pile onto empty canvas stays face-up.
- Dragging several cards from a hand onto an empty canvas makes one pile. One prompt asks whether that pile is face-up or face-down. All of the cards follow that choice. Dragging several cards from a face-down deck or pile onto empty canvas does the same: one pile, and one prompt sets that whole pile face-up or face-down. A pile dragged from a face-up deck or pile onto empty canvas stays face-up.
- Any seated player can write in the shared chat. Each message shows their name. The log is saved with the table and is still there after a restart.
- A dummy player stands in for a seat no person is using. There is no extra-hand entity and no holder on one. A seated player creates a dummy, gives it a name, and it starts with an empty face-down hand. Creating it asks which public window receives that hand.
- Seated players, dummies, and players who are away appear in one list beside the windows. The list is chrome: it stays put for each player, and it is not a window anyone drags or resizes. Each player scrolls it on their own. Everyone sees the same names and marks. Each has an avatar on the public table's canvas. Anyone seated can drag an avatar around that table, and the move is shared with everyone. An avatar cannot be moved into another window. A new avatar appears in an open spot on that canvas, and its position is saved with the table. A dummy's avatar and list entry are marked so it is clear that no person is connected. A dummy has no private window and cannot write in chat. The first person to drag an avatar locks it until they drop it. A player who leaves stays in the list, and their avatar stays on the public table, with an away mark different from a dummy's mark. Any seated player sees that mark, and assume ownership is offered on that entry. If they rejoin before a takeover, the away mark clears. If someone assumes ownership, that entry and avatar go away. The hand then shows the new owner's name, and the new owner keeps their own avatar. Clicking a name scrolls only that player's view of the public table so the avatar is in view, and highlights the avatar for a short time on their screen only. Other players stay where they were and do not see the highlight. The click does not open a hand or reveal faces. Assume ownership stays a separate control on an away entry.
- A dummy's own assets stay public. It has no private windows, and its hand cannot be hidden by moving the last public view into a private window. A real player's hand is unchanged: only that player moves cards out of it, and only that player's private window shows its faces.
- Any seated player who is not a dummy can open another public view, or their own private view, of a dummy's hand and use that view to interact with it. They can share a private view the same way as any other private window. Card moves change the one shared hand, so every view updates. The private view is that real player's window: their own frame, size, and scroll. Fan, row, or grid on that view is theirs alone.
- Any seated player can move cards into or out of a dummy hand, flip it, and include it in a deal. A player's own hand is still flipped only by that player, and other players still cannot drop cards onto it.
- A face-down dummy hand shows its faces in each real player's own private view of that hand, to the player who opened it and to the people they invited. Bo sees the faces in his own private view even when he is not invited to Ada's. A view he is not in still shows backs, and the public table shows backs. Flipping the hand face-up shows the faces in every view. Flipping it face-down again returns the public table to backs. Each private view still shows faces to its owner and invitees. Switching a private view to public does not reveal the hidden faces. It becomes another public view and shows backs while the hand stays face-down.
- A dummy's name is reserved the same way as a seated player's name. Joining with that name is refused while the dummy exists, and the dummy keeps the name. A dummy cannot be given a name a seated player, a gone player who can still rejoin, or another dummy already has. Renaming the dummy, or deleting it, frees the old name. Deleting it follows the usual delete confirmation and removes its hand from every view, along with its avatar and list entry.
- A loose card has its own face-up or face-down state, separate from the deck or hand it left. Any seated player who can see it can flip it. While it is face-down, everyone who can see it sees the back.

## Still open

- Whether the object context menu can close a private window.
- Whether that menu can delete one card inside a deck, pile, or hand.

Further decisions are still being collected.
