import Vue from 'vue';
import VueRouter from 'vue-router'
import App from './App.vue';
import Landing from './components/Landing.vue';
import Resume from './components/Resume.vue';
import './assets/css/app.css';
import '@fortawesome/fontawesome-free/js/all.js';

Vue.config.productionTip = false;

Vue.use(VueRouter);

const routes = [
    {
        path: '/',
        component: Landing
    },
    {
        path: '/resume',
        component: Resume
    },
];

const router = new VueRouter({
    routes // short for `routes: routes`
});

new Vue({
    render: h => h(App),
    router
}).$mount('#app')
