# RSC 邊界 + Client Component children 的「假陣列」陷阱

## TL;DR

當 **server component** 把 JSX element 當作 children 傳給 **client component** 時，children 跨越 RSC 邊界後，原本「單一 element」會被包成「陣列」。如果該 client component 內部用 `React.Children.only(children)` 檢查，就會炸錯。

**修法：把 client component + 它的 JSX children 放到同一個 `"use client"` 檔案裡，讓 children 不要跨界。**

---

## 真實案例（這個專案踩過）

### 壞掉的寫法

```tsx
// src/app/page.tsx — async server component
import { Show, SignInButton } from "@clerk/nextjs";

export default async function Home() {
  return (
    <Show when="signed-out">
      <SignInButton mode="modal">
        <button className="...">Sign in</button>
      </SignInButton>
    </Show>
  );
}
```

### 噴的錯

```
@clerk/react: You've passed multiple children components to <SignInButton/>.
You can only pass a single child component or text.

  at assertSingleChild
  at SignInButton.component
  ...
  at renderChildrenArray   ← smoking gun
```

JSX 寫的明明是單一 `<button>`，為何 Clerk 看到多個 children？

---

## 為什麼會這樣

### 一般 React 世界

```jsx
<SignInButton>
  <button>X</button>
</SignInButton>
```

編譯後：
```js
jsx(SignInButton, { children: jsx("button", ...) })
//                            ^^^^^^^^^^^^^^^^^^
//                            單一 React element 物件
```

`Children.only(children)` ✅ 通過。

### RSC 世界（Next 13+ App Router、Next 16 + React 19 更明顯）

```
[server.tsx]
  <SignInButton>           ← client component reference（函式不在 server 跑）
    <button/>              ← 要被序列化進 RSC payload
  </SignInButton>
```

children 經過 **RSC 序列化 → wire format → 反序列化** 後：

```
傳出去:  children = <button/>          // 單一 element
傳到 SSR: children = [<button/>]       // 變成陣列了
```

接著 SSR 執行 `SignInButton` 函式（為了產 HTML），`Children.only([<button/>])` 看到 array 就丟「multiple children」。

stack trace 裡的 `renderChildrenArray` 就是 React DOM 在 SSR 把 children 當陣列處理的證據。

### 加成因子：async server component 包 Fragment

`<Show>` 這類 async server component 內部常做：

```js
React.createElement(Fragment, null, children)
```

這層 Fragment 讓 children 多繞一次 RSC 邊界，更穩定地觸發 array 化。

---

## 修法：client wrapper

把 `<SignInButton>` + `<button>` 包進同一個 `"use client"` 檔案：

```tsx
// src/components/AuthButtons.tsx
"use client";
import { SignInButton } from "@clerk/nextjs";

export function StyledSignInButton({ className, children }: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <SignInButton mode="modal">
      <button className={className}>{children}</button>
    </SignInButton>
  );
}
```

server component 改用 wrapper：

```tsx
// page.tsx
<Show when="signed-out">
  <StyledSignInButton className="...">Sign in</StyledSignInButton>
</Show>
```

關鍵點：
- server 看到的 children 是字串 `"Sign in"` — 字串穿越 RSC 邊界沒問題
- `<button>` 在 client render pass 內產生，**不跨界**
- `<SignInButton>` 拿到的 children 是真正的單一 element

---

## 視覺化

```
壞:
┌────── server ──────┐
│ <SignInButton ← client ref
│   <button/> ← 跨界被包成 [<button/>]  ❌
│ </SignInButton>
└────────────────────┘

好:
┌────── server ──────┐
│ <StyledSignInButton ← client ref
│   "Sign in" (字串)  ← 字串穿 RSC 沒事  ✅
│ </StyledSignInButton>
└────────────────────┘
        │
        ▼ client 接手
┌────── client ──────┐
│ <SignInButton>
│   <button/>  ← 同一 render pass，沒跨界
│ </SignInButton>
└────────────────────┘
```

---

## 何時該警覺

只要符合以下三條，就要小心：

1. JSX 在 **server component**（含 async server component）內
2. 包了一個 **client component**（從 `"use client"` 檔匯出，或第三方標記為 client 的 component）
3. 該 client component 內部用 `React.Children.only`、`React.Children.map`、`React.cloneElement` 等對 children 做斷言或操作

常見受害者（Children.only 派）：
- Clerk: `<SignInButton>`、`<SignUpButton>`、`<SignOutButton>` 等 unstyled 按鈕
- Radix UI / shadcn: 任何用 `asChild` pattern 的 trigger（`<DialogTrigger asChild>`、`<TooltipTrigger asChild>`、`<NavigationMenuTrigger asChild>`）
- 老版本的 `next/link`（傳 `<a>` 當 child 的寫法）
- 任何在 README 寫「需要單一 child」的 library

## 通用解法模板

```tsx
// SomeStyledTrigger.tsx
"use client";
import { ThirdPartyTrigger } from "third-party-lib";

export function SomeStyledTrigger(props: ...) {
  return (
    <ThirdPartyTrigger asChild>
      <button {...props} />
    </ThirdPartyTrigger>
  );
}
```

server component 只看到一顆 `<SomeStyledTrigger>`，內部的 `asChild` + `<button>` 都在 client 端完成。

---

## 反向陷阱：別把整個 page 都標 `"use client"`

看到這篇別矯枉過正，不要為了避開這個 bug 就把整個頁面 `"use client"`。會失去：
- async server component（如 `<Show>`、`auth()` 拿 user 等）
- server-only data fetching、redirect()
- 較小的 client bundle

正確策略是**只把出問題的 client component + 它的 JSX children** 包成一個 client wrapper，其他維持 server 原狀。

---

## 參考

- React: [`Children.only`](https://react.dev/reference/react/Children#children-only)
- Next.js: [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- Clerk: [`<SignInButton>` 文件](https://clerk.com/docs/nextjs/reference/components/unstyled/sign-in-button)
