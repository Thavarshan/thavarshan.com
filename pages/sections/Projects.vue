<template>
    <div class="py-16 bg-gray-50">
        <github></github>

        <divider></divider>

        <emberfuse></emberfuse>

        <divider></divider>

        <exogym></exogym>

        <divider></divider>

        <bitbucket></bitbucket>
    </div>
</template>

<script>
import Github from './Github';
import Emberfuse from './Emberfuse';
import Exogym from './Exogym';
import Bitbucket from './Bitbucket';

export default {
    components: {
        Github,
        Emberfuse,
        Exogym,
        Bitbucket
    }
}
</script>
