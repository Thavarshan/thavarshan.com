import {
    Box,
    Flex,
    Heading,
    HStack,
    Link,
    Stack,
    Text
} from '@chakra-ui/react';
import Image from 'next/image';
import photo from '@/assets/images/jerome.jpg';
import { FaLinkedin, FaBitbucket, FaGithub, FaPaperPlane } from 'react-icons/fa';
import { CgFileDocument } from 'react-icons/cg';
import SEO from '@/components/SEO';

const Home = () => {
    return (
        <>
            <SEO />

            <Box className="mt-10 lg:mt-0 text-center lg:text-left">
                <Stack spacing={6} align={{ base: 'center', lg: 'start' }}>
                    <Heading as='h3' color='white' size='lg'>Jerome <span className='font-light text-gray-300'>(Thavarshan) Thayananthajothy</span></Heading>

                    <Text color='gray.400' maxW={{ base: 'full', md: 'xl', xl: 'lg' }} mx={{ base: 0, md: 'auto' }}>
                        Hello, my name is Jerome. I am a professional Software Engineer with a passion for graphic design and a part-time artist. I thrive on finding innovative solutions to everyday problems and take pride in continually refining my skills. Outside of work, I enjoy creating unique traditional pencil sketch portraits.
                    </Text>

                    <Flex align='center' justify={{ base: 'center', lg: 'start' }}>
                        <Flex align='start'>
                            <Image alt='Jerome' className='rounded-full grayscale' src={photo.src} width={100} height={100} priority />

                            <Stack spacing={2} ml='6' my='auto'>
                                <Link href='https://www.linkedin.com/in/thavarshan/' color='white' isExternal display='flex' className='items-center'>
                                    <HStack spacing={2}>
                                        <FaLinkedin />
                                        <Text>Linkedin Profile</Text>
                                    </HStack>
                                </Link>

                                <Link href='https://github.com/Thavarshan/' color='white' isExternal display='flex' className='items-center'>
                                    <HStack spacing={2}>
                                        <FaGithub />
                                        <Text>Github Projects</Text>
                                    </HStack>
                                </Link>

                                <Link href='https://bitbucket.org/thavarshan/' color='white' isExternal display='flex' className='items-center'>
                                    <HStack spacing={2}>
                                        <FaBitbucket />
                                        <Text>Bitbucket Projects</Text>
                                    </HStack>
                                </Link>

                                <Link href='mailto:tjthavarshan@gmail.com' color='white' isExternal display='flex' className='items-center'>
                                    <HStack spacing={2}>
                                        <FaPaperPlane />
                                        <Text>Get in touch</Text>
                                    </HStack>
                                </Link>

                                <Link href='/docs/Jerome_Thayananthajothy_CV.pdf' color='white' isExternal display='flex' className='items-center'>
                                    <HStack spacing={2}>
                                        <CgFileDocument />
                                        <Text>Résumé</Text>
                                    </HStack>
                                </Link>
                            </Stack>
                        </Flex>
                    </Flex>

                    <Text color='gray.400' maxW={{ base: 'full', md: 'xl', xl: 'lg' }} mx={{ base: 0, md: 'auto' }}>
                        Although I specialize in PHP & TypeScript, I do have mid-level experience with C++, Java, and Python. I am now working on broadening my horizon by exploring Machine Learning, Rust, and Golang.
                    </Text>
                </Stack>
            </Box>
        </>
    );
};

export default Home;
