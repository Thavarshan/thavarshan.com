import { mount } from '@vue/test-utils';
import Divider from '@/components/Divider.vue';

describe('Divider', () => {
    test('is a Vue instance', () => {
        const wrapper = mount(Divider);

        expect(wrapper.vm).toBeTruthy();
    });

    test('matches expected structure', () => {
        const wrapper = mount(Divider);

        expect(wrapper.vm).toMatchSnapshot();
    });
});
