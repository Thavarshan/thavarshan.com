import Logo from '@/components/Logo';
import {
    Container,
    Box,
    Stack,
    Button,
    Link
} from '@chakra-ui/react';
import { NextSeo } from 'next-seo';

const Layout = ({ children }: any) => {
    return (
        <>
            <NextSeo
                title='Jerome Thayananthajothy'
                description='Jerome Thayananthajothy | Personal Portfolio'
                openGraph={{
                    url: 'https://www.thavarshan.xyz',
                    title: 'Jerome Thayananthajothy',
                    description: 'Jerome Thayananthajothy | Personal Portfolio',
                    images: [
                        { url: 'https://www.thavarshan.xyz/images/jerome.jpg' }
                    ],
                    siteName: 'Jerome Thayananthajothy',
                }} />

            <Container maxW='container.xl' py={{ base: 6, md: 24 }}>
                <Box position='fixed' w='48'>
                    <Box>
                        <Link href='/'>
                            <Box h={20} w={20}>
                                <Logo className='text-white' />
                            </Box>
                        </Link>
                    </Box>

                    <Stack spacing='4' mt='10'>
                        <Link href='/' color='white' fontWeight='medium' rounded='xl' fontSize='sm'>Home</Link>
                        <Link href='/projects' color='white' fontWeight='medium' rounded='xl' fontSize='sm'>Projects</Link>
                        <Link href='https://github.com/Thavarshan' color='white' fontWeight='medium' rounded='xl' fontSize='sm' isExternal>Github</Link>
                        <Link href='https://www.linkedin.com/in/thavarshan/' color='white' fontWeight='medium' rounded='xl' fontSize='sm' isExternal>LinkedIn</Link>
                    </Stack>
                </Box>

                <Box ml='48'>
                    {children}
                </Box>
            </Container>
        </>
    );
};

export default Layout;
