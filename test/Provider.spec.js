import { mount } from '@vue/test-utils';
import Provider from '@/components/Provider.vue';

describe('Provider', () => {
    test('can fetch api data', () => {
        const wrapper = mount(Provider, {
            propsData: {
                uri: ''
            },

            data: {
                data: []
            }
        });

        expect(wrapper.vm).toBeTruthy();
    });
});
