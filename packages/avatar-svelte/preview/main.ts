import { mount } from 'svelte'
import App from './app.svelte'

const target = document.querySelector('#app')
if (target) mount(App, { target })
