@extends('layouts.master')

@section('body')
    <section id="hero-section" class="py-16">
        <div class="container">
            <div class="row justify-center">
                <div class="col-lg-2">
                    <div class="overflow-hidden rounded-full w-40 h-40 mx-auto mb-4 hover:shadow-xl">
                        <img src="/assets/img/me.jpg" alt="Thavarshan" class="w-full cursor-pointer">
                    </div>
                </div>

                <div class="col-lg-5 col-md-9">
                    <div class="leading-loose text-lg text-center lg:text-left">
                        <h4 class="font-bold text-gray-800">
                            So who am I?
                        </h4>

                        <p>
                            I'm <a class="font-semibold underline" target="_blank" href="https://twitter.com/thavarshan">@thavarshan</a> , a Full-Stack Developer, Electronics &amp; Telecommunications Engineer, Graphic Designer and Part-time Artist.
                        </p>

                        <p>
                            Basically, I love to create, make and build. I spend countless hours sitting in front of a computer screen making something amazing for my clients or drawing a pencil sketch portrait of them.
                        </p>

                        <p>
                            Right now I'm working on <a class="font-semibold underline" target="_blank" href="https://github.com/emberfuse/emberfuse">Emberfuse PHP</a> &amp; <a class="font-semibold underline" target="_blank" href="https://cratespace.netlify.com/">Cratespace</a>, and I share updates about my progress on <a class="font-semibold underline" href="/blog">my blog</a> which I'm not done with yet.
                        </p>

                        <p class="mb-0">
                            <a class="inline-block text-blue-500 hover:text-blue-400" href="mailto:tjthavarshan@gmail.com">Contact me <span>&rarr;</span></a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section id="section-common-sites" class="pt-16 bg-image">
        <div class="container">
            <div class="row mb-5">
                <div class="col">
                    <h4>Professional Projects</h4>

                    <p class="max-w-md text-sm text-gray-600 m-0">
                        A list of projects done for clients through out my years as a freelancer and an employee at <span class="font-semibold">Pearl Cluster (Pvt) Ltd</span>.
                    </p>
                </div>
            </div>

            <div class="row">
                <div class="col-lg-3 col-md-6 flex flex-col">
                    <div class="bg-white hover:shadow-xl p-4 flex flex-col justify-between leading-normal flex flex-col flex-1 mb-4">
                        <div>
                            <div class="text-gray-700 font-bold text-xl mb-2">
                                <a target="_blank" href="https://altavision.lk">Alta Vision Solar (Pvt) Ltd</a>
                            </div>

                            <div class="text-gray-500 text-xs mb-4">
                                Alta Vision Solar bring together the best solar equipment in the world with unparalleled engineering expertise to offer tailor-made solar solutions to Sri Lanka.
                            </div>
                        </div>

                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-500">
                                23 July 2016
                            </span>
                        </div>
                    </div>
                </div>

                <div class="col-lg-3 col-md-6 flex flex-col">
                    <div class="bg-white hover:shadow-xl p-4 flex flex-col justify-between leading-normal flex flex-col flex-1 mb-4">
                        <div>
                            <div class="text-gray-700 font-bold text-xl mb-2">
                                <a target="_blank" href="https://design470.com">Design470 (Pvt) Ltd</a>
                            </div>

                            <div class="text-gray-500 text-xs mb-4">
                                Design470 digital agency mainly focused on Graphic Design, Web Interactions and Branding, based in Sri Lanka.
                            </div>
                        </div>

                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-500">
                                23 July 2016
                            </span>
                        </div>
                    </div>
                </div>

                <div class="col-lg-3 col-md-6 flex flex-col">
                    <div class="bg-white hover:shadow-xl p-4 flex flex-col justify-between leading-normal flex flex-col flex-1 mb-4">
                        <div>
                            <div class="text-gray-700 font-bold text-xl mb-2">
                                <a target="_blank" href="https://hfashiondesign.com">H Fashion <sup>&reg;</sup></a>
                            </div>

                            <div class="text-gray-500 text-xs mb-4">
                                H. Fashion Design is an international fashion and lifestyle brand offering feminine fashion designs in which women feel confident, strong, and fearless.
                            </div>
                        </div>

                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-500">
                                23 July 2016
                            </span>
                        </div>
                    </div>
                </div>

                <div class="col-lg-3 col-md-6 flex flex-col">
                    <div class="bg-white hover:shadow-xl p-4 flex flex-col justify-between leading-normal flex flex-col flex-1 mb-4">
                        <div>
                            <div class="text-gray-700 font-bold text-xl mb-2">
                                <a target="_blank" href="https://subodhacharles.net">Subodha Charles <sup>&reg;</sup></a>
                            </div>

                            <div class="text-gray-500 text-xs mb-4">
                                PhD Studen UF, Entreprenuer. Personal website and portfolio.
                            </div>
                        </div>

                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-500">
                                23 July 2016
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section id="portfoilo-github-section" class="pt-16 bg-image">
        <div class="container">
            <div class="row mb-5">
                <div class="col">
                    <h4>Personal Projects on GitHub</h4>

                    <p class="max-w-md text-sm text-gray-600 m-0">
                        A list of personal projects (GitHub repos) now hosted as open source projects or as templates on <span class="font-bold">GitHub</span>.
                    </p>
                </div>
            </div>

            <github></github>
        </div>
    </section>

    <section id="portfoilo-github-section" class="pt-16 bg-image">
        <div class="container">
            <div class="row mb-5">
                <div class="col">
                    <h4>Coding Challenges on BitBucket</h4>

                    <p class="max-w-md text-sm text-gray-600 m-0">
                        A list of code katas and coding challenges I did and am doing.
                    </p>
                </div>
            </div>

            <bitbucket></bitbucket>
        </div>
    </section>

    <section id="portfoilo-github-section" class="pt-16 pb-16 bg-image">
        <div class="container">
            <div class="row mb-5">
                <div class="col">
                    <h4>Emberfuse PHP</h4>

                    <p class="max-w-md text-sm text-gray-600">
                        Emberfuse is a simple PHP framework and Svelt a nano PHP framework. These are attempts at making my own PHP framework using all the knowledge and experience I've gained so far learning PHP.
                    </p>

                    <div>
                        <a href="https://emberfuse.netlify.com" target="_blank" class="text-blue-500 hover:text-blue-400 text-sm">View official site <span>&rarr;</span></a>
                    </div>
                </div>
            </div>

            <emberfuse></emberfuse>
        </div>
    </section>
@endsection
