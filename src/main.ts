import content from 'composably:content';
import { mount } from 'svelte';
const path = window.location.pathname.slice(1);

(async () => {
  const App = await content(path);
  const target = document.getElementById('app');

  if (!target) {
    throw target;
  }
  const app = mount(App.component, {
    target,
    props: App
  });
  console.log(app);
})();
