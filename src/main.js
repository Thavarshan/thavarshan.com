import Vue from 'vue';
import VueRouter from 'vue-router'
import App from './App.vue';
import Landing from './components/Landing.vue';
import VueAnalytics from 'vue-ua';
import './assets/css/app.css';
import '@fortawesome/fontawesome-free/js/all.js';

Vue.config.productionTip = false;

Vue.use(VueRouter);

const routes = [
    {
        path: '/',
        component: Landing
    }
];

const router = new VueRouter({
    mode: 'history',
    routes // short for `routes: routes`
});

Vue.use(VueAnalytics, {
    appName: 'Thavarshan',
    appVersion: '2.0.1',
    trackingId: 'UA-162757472-1',
    vueRouter: router,
});

new Vue({
    render: h => h(App),
    router
}).$mount('#app')
