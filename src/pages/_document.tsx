import { Html, Head, Main, NextScript } from 'next/document';

export default function Document () {
    return (
        <Html lang="en">
            <Head />

            <body className='bg-gray-900 leading-normal text-gray-600 antialiased'>
                <Main />

                <NextScript />
            </body>
        </Html>
    );
}
