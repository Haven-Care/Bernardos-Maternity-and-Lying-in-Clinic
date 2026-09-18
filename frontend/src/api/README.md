# `src/api/` — the swap seam

Every backend call in the app goes through this directory. One file per domain,
one exported function per operation. **Components never import from
`src/mocks/`** — they call these functions and don't know the data is fake.

Each function today returns fixture data and carries a `// BACKEND:` comment
holding the real call. Swapping a domain means uncommenting one line and deleting
one line, per function. Nothing in any component changes.

```bash
# every remaining stub
grep -rn "// BACKEND:" src/api
```

## Rules

- **Functions are `async` and fully typed.** Components are already written
  against the final signature, so the swap is invisible to them.
- **Every read goes through `mockDelay()`**, which adds ~300 ms. Without it you
  build screens that never show a spinner, and they all break the day real
  latency arrives.
- **Derived values are computed here, not in components.** `qtyOnHand`, Low
  Stock, Days Left, and the dashboard aggregates are all things the backend will
  eventually compute and return. Putting that logic here means the swap replaces
  it wholesale; putting it in a component means rewriting the component.
- **Mutations mutate the fixture arrays.** Confirm, Cancel, and Add Medicine
  genuinely change what every screen renders. A prototype where the buttons do
  nothing doesn't demo.

## Exercising failure

`mockDelay` can be told to reject, from the dev console:

```js
__havencare.setMockFailureRate(1)   // every call fails
__havencare.setMockFailureRate(0)   // back to normal
```

Build the error state when you build the screen.

## Swap order

Domains are independent. Flip one at a time — the rest keep running on fixtures
while you go. Suggested order, easiest first:

`services` → `slots` → `clinic` → `account` → `patients` → `inventory` →
`appointments` → `dashboard`

`dashboard` goes last because it aggregates across every other domain.
