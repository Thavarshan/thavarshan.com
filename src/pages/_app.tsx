import '@/assets/css/globals.css';
import 'simplebar-react/dist/simplebar.min.css';
import type { AppProps } from 'next/app';
import Layout from '@/layouts/default';
import { ChakraProvider } from '@chakra-ui/react';
import { Inter } from 'next/font/google';
import { DefaultSeo } from 'next-seo';
import { Analytics } from '@vercel/analytics/react';
import { NextPage } from 'next';
import { ReactNode } from 'react';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
});

export type NextPageWithLayout<P = any, IP = P> = NextPage<P, IP> & {
    getLayout?: (page: NextPage) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
    Component: NextPageWithLayout;
};

const App = ({ Component, pageProps }: AppPropsWithLayout) => {
    const getLayout: any = Component.getLayout ?? (
        (page: NextPageWithLayout) => <Layout>{page}</Layout>
    );

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
                {getLayout(<Component {...pageProps} />)}
                <Analytics />
            </main>
        </ChakraProvider>
    );
};

export default App;
