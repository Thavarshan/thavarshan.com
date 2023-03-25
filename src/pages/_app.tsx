import '@/assets/css/globals.css';
import 'simplebar-react/dist/simplebar.min.css';
import type { AppProps } from 'next/app';
import { ChakraProvider } from '@chakra-ui/react';
import { Inter } from 'next/font/google';
import { DefaultSeo } from 'next-seo';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
});

export default function App ({ Component, pageProps }: AppProps) {
    return (
        <ChakraProvider>
            <main className={inter.className}>
                <DefaultSeo
                    openGraph={{
                        type: 'website',
                        locale: process.env.NEXT_PUBLIC_LANG,
                        url: process.env.NEXT_PUBLIC_BASE_URL,
                        siteName: 'Jerome Thayananthajothy',
                    }}
                />
                <Component {...pageProps} />
            </main>
        </ChakraProvider>
    );
}
