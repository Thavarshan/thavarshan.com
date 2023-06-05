import { Html, Head, Main, NextScript } from 'next/document';

export default function Document () {
    return (
        <Html lang="en">
            <Head />

            <body className='bg-gradient-to-br from-slate-700 to-slate-950 bg-fixed leading-normal text-gray-600 antialiased min-h-screen'>
                <Main />

                <NextScript />
            </body>
        </Html>
    );
}
