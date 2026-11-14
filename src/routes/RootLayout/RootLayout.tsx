import { Outlet, ScrollRestoration } from 'react-router';

// Root of the whole route tree, so every page (including /signup) shares it.
// ScrollRestoration resets the scroll to the top on each new location, and
// restores the saved offset on Back and Forward. A replace navigation such as
// the post-login redirect gets a new location key, so it starts at the top.
function RootLayout() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

export default RootLayout;
