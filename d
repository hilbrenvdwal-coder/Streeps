import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Svg, Path, G, Defs, Filter, FeFlood, FeBlend, FeGaussianBlur, Ellipse, FeColorMatrix, FeMorphology, FeOffset, FeComposite } from 'react-native-svg';

export default function Home() {
    return (
        <View style={styles.homeContainer}>
            <View style={styles.scroll}>
                    <Svg style={styles.rectangle2} width="350" height="50" viewBox="0 0 350 50" fill="none" >
<Path d="M0 25C0 11.1929 11.1929 0 25 0H325C338.807 0 350 11.1929 350 25C350 38.8071 338.807 50 325 50H25C11.1929 50 0 38.8071 0 25Z" fill="#606060"/>
</Svg>

                    <Text style={styles.selecteergroep}>
                        {`Selecteer groep`}
                    </Text>
                        <Svg style={styles.vector} width="350" height="120" viewBox="0 0 350 120" fill="none" >
<G filter="url(#filter0_f_156_56)">
<Path d="M392.858 -103.257C407.768 -43.0022 322.596 29.9114 202.619 59.6004C82.6434 89.2894 -26.7038 64.5111 -41.6142 4.25665C-56.5246 -55.9978 28.6479 -128.911 148.624 -158.6C268.6 -188.289 377.947 -163.511 392.858 -103.257Z" fill="#FF0085"/>
<Path d="M351.48 -93.0174C362.578 -48.1663 291.684 7.96257 193.132 32.35C94.58 56.7373 5.69071 40.1482 -5.40803 -4.70284C-16.5068 -49.5539 54.3879 -105.683 152.94 -130.07C251.491 -154.458 340.381 -137.868 351.48 -93.0174Z" fill="#FF00F5"/>
<Path d="M311.013 -86.4858C317.627 -59.7564 267.798 -24.4305 199.717 -7.58313C131.635 9.26419 71.0819 1.25316 64.4675 -25.4763C57.8531 -52.2057 107.682 -87.5316 175.764 -104.379C243.845 -121.226 304.399 -113.215 311.013 -86.4858Z" fill="#00BEAE"/>
<Path d="M252.394 -71.98C255.645 -58.8419 227.791 -40.6462 190.179 -31.339C152.568 -22.0317 119.442 -25.1373 116.191 -38.2755C112.94 -51.4137 140.794 -69.6093 178.406 -78.9166C216.017 -88.2238 249.143 -85.1182 252.394 -71.98Z" fill="#00FE96"/>
</G>
<Defs>
<Filter id="filter0_f_156_56" x="-97.4082" y="-225.252" width="546.06" height="351.505" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_156_56"/>
</Filter>
</Defs>
</Svg>

                        <Svg style={styles.rectangle4} width="55" height="55" viewBox="0 0 55 55" fill="none" >
<Path d="M0 27.5C0 12.3122 12.3122 0 27.5 0C42.6878 0 55 12.3122 55 27.5C55 42.6878 42.6878 55 27.5 55C12.3122 55 0 42.6878 0 27.5Z" fill="#F1F1F1"/>
</Svg>

                        <Text style={styles.groepnaam}>
                            {`It Hok`}
                        </Text>
                        <Svg style={styles.group7} width="350" height="50" viewBox="0 0 350 50" fill="none" >
<G filter="url(#filter0_f_122_38)">
<Ellipse cx="218.388" cy="52.8711" rx="218.388" ry="52.8711" transform="matrix(0.994726 -0.102564 0.510633 0.859799 -68.6118 -43.6849)" fill="#3A747F"/>
</G>
<G filter="url(#filter1_f_122_38)">
<Ellipse cx="179.39" cy="39.3552" rx="179.39" ry="39.3552" transform="matrix(0.994726 -0.102564 0.510633 0.859799 -25.504 -35.797)" fill="#848484"/>
</G>
<G filter="url(#filter2_f_122_38)">
<Ellipse cx="123.926" cy="23.4541" rx="123.926" ry="23.4541" transform="matrix(0.994726 -0.102564 0.510633 0.859799 52.4912 -30.7809)" fill="#848484"/>
</G>
<G filter="url(#filter3_f_122_38)">
<Ellipse cx="68.4628" cy="11.5283" rx="68.4628" ry="11.5283" transform="matrix(0.994726 -0.102564 0.510633 0.859799 110.304 -25.8601)" fill="#8A8A8A"/>
</G>
<Defs>
<Filter id="filter0_f_122_38" x="-97.4081" y="-125.413" width="546.06" height="209.577" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_38"/>
</Filter>
<Filter id="filter1_f_122_38" x="-60.6521" y="-112.982" width="467.376" height="185.247" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_38"/>
</Filter>
<Filter id="filter2_f_122_38" x="9.77842" y="-101.266" width="355.924" height="155.881" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_38"/>
</Filter>
<Filter id="filter3_f_122_38" x="61.8329" y="-89.218" width="244.919" height="132.496" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_38"/>
</Filter>
</Defs>
</Svg>

                        <Text style={styles._streepjessoorten}>
                            {`€ 1,50`}
                        </Text>
                        <Text style={styles.__streepjessoorten}>
                            {`Normaal`}
                        </Text>
                        <Svg style={styles.Group7} width="350" height="75" viewBox="0 0 350 75" fill="none" >
<G filter="url(#filter0_f_122_47)">
<Ellipse cx="229.326" cy="58.9503" rx="229.326" ry="58.9503" transform="matrix(0.98825 -0.152844 0.368128 0.929775 -87.4026 -62.6211)" fill="#00FE96"/>
</G>
<G filter="url(#filter1_f_122_47)">
<Ellipse cx="188.375" cy="43.8803" rx="188.375" ry="43.8803" transform="matrix(0.98825 -0.152844 0.368128 0.929775 -44.0829 -54.4513)" fill="#FF00F5"/>
</G>
<G filter="url(#filter2_f_122_47)">
<Ellipse cx="130.133" cy="25.8481" rx="130.133" ry="25.8481" transform="matrix(0.98825 -0.152844 0.368128 0.929775 113 -23.2199)" fill="#FF0085"/>
</G>
<G filter="url(#filter3_f_122_47)">
<Ellipse cx="71.8918" cy="12.8538" rx="71.8918" ry="12.8538" transform="matrix(0.98825 -0.152844 0.368128 0.929775 94.3911 -47.003)" fill="#00FE96"/>
</G>
<Defs>
<Filter id="filter0_f_122_47" x="-120.854" y="-162.029" width="563.568" height="238.336" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_47"/>
</Filter>
<Filter id="filter1_f_122_47" x="-82.7399" y="-146.484" width="481.944" height="208.079" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_47"/>
</Filter>
<Filter id="filter2_f_122_47" x="54.158" y="-118.274" width="393.923" height="198.394" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="34" result="effect1_foregroundBlur_122_47"/>
</Filter>
<Filter id="filter3_f_122_47" x="44.8629" y="-116.375" width="250.614" height="140.67" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_47"/>
</Filter>
</Defs>
</Svg>

                        <Text style={styles.___streepjessoorten}>
                            {`Drankenlijst`}
                        </Text>
                        <Svg style={styles.Group7} width="350" height="75" viewBox="0 0 350 75" fill="none" >
<G filter="url(#filter0_f_122_55)">
<Ellipse cx="229.326" cy="58.9503" rx="229.326" ry="58.9503" transform="matrix(0.98825 -0.152844 0.368128 0.929775 -87.4025 -62.6211)" fill="#00FE96"/>
</G>
<G filter="url(#filter1_f_122_55)">
<Ellipse cx="98.2557" cy="43.8803" rx="98.2557" ry="43.8803" transform="matrix(0.9917 0.128575 0.0944764 0.995527 33.5265 -92.3657)" fill="#FF00F5"/>
</G>
<G filter="url(#filter2_f_122_55)">
<Ellipse cx="130.133" cy="25.8481" rx="130.133" ry="25.8481" transform="matrix(0.98825 -0.152844 0.368128 0.929775 113 -23.22)" fill="#FF0085"/>
</G>
<G filter="url(#filter3_f_122_55)">
<Ellipse cx="71.8918" cy="12.8538" rx="71.8918" ry="12.8538" transform="matrix(0.98825 -0.152844 0.368128 0.929775 94.3912 -47.0031)" fill="#00FE96"/>
</G>
<Defs>
<Filter id="filter0_f_122_55" x="-120.854" y="-162.029" width="563.568" height="238.336" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_55"/>
</Filter>
<Filter id="filter1_f_122_55" x="-16.5176" y="-135.634" width="303.26" height="199.172" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_55"/>
</Filter>
<Filter id="filter2_f_122_55" x="54.158" y="-118.274" width="393.923" height="198.394" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="34" result="effect1_foregroundBlur_122_55"/>
</Filter>
<Filter id="filter3_f_122_55" x="44.863" y="-116.375" width="250.614" height="140.67" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_55"/>
</Filter>
</Defs>
</Svg>

                        <Text style={styles.____streepjessoorten}>
                            {`Instellingen...`}
                        </Text>
                        <Svg style={styles.Group7} width="350" height="100" viewBox="0 0 350 100" fill="none" >
<G filter="url(#filter0_f_122_63)">
<Ellipse cx="219.819" cy="73.3379" rx="219.819" ry="73.3379" transform="matrix(0.98825 -0.152844 0.368128 0.929775 -68.6118 -65.5273)" fill="#00FE96"/>
</G>
<G filter="url(#filter1_f_122_63)">
<Ellipse cx="180.565" cy="54.5899" rx="180.565" ry="54.5899" transform="matrix(0.98825 -0.152844 0.368128 0.929775 -25.504 -53.6956)" fill="#FF00F5"/>
</G>
<G filter="url(#filter2_f_122_63)">
<Ellipse cx="124.738" cy="32.5333" rx="124.738" ry="32.5333" transform="matrix(0.98825 -0.152844 0.368128 0.929775 52.4912 -46.1714)" fill="#00BEAE"/>
</G>
<G filter="url(#filter3_f_122_63)">
<Ellipse cx="68.9114" cy="15.991" rx="68.9114" ry="15.991" transform="matrix(0.98825 -0.152844 0.368128 0.929775 110.304 -38.7902)" fill="#00FE96"/>
</G>
<Defs>
<Filter id="filter0_f_122_63" x="-97.4081" y="-161.07" width="546.06" height="260.265" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_63"/>
</Filter>
<Filter id="filter1_f_122_63" x="-60.6521" y="-142.423" width="467.376" height="223.771" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_63"/>
</Filter>
<Filter id="filter2_f_122_63" x="9.77842" y="-124.849" width="355.924" height="179.721" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_63"/>
</Filter>
<Filter id="filter3_f_122_63" x="61.8329" y="-106.777" width="244.919" height="144.644" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_63"/>
</Filter>
</Defs>
</Svg>

                        <Text style={styles._____streepjessoorten}>
                            {`Leden`}
                        </Text>
                        <Svg style={styles.Group7} width="350" height="50" viewBox="0 0 350 50" fill="none" >
<G filter="url(#filter0_f_122_73)">
<Ellipse cx="218.388" cy="52.8711" rx="218.388" ry="52.8711" transform="matrix(0.994726 -0.102564 0.510633 0.859799 -68.6118 -43.6849)" fill="#F1F1F1"/>
</G>
<G filter="url(#filter1_f_122_73)">
<Ellipse cx="179.39" cy="39.3552" rx="179.39" ry="39.3552" transform="matrix(0.994726 -0.102564 0.510633 0.859799 -25.504 -35.797)" fill="#FF00F5"/>
</G>
<G filter="url(#filter2_f_122_73)">
<Ellipse cx="123.926" cy="23.4541" rx="123.926" ry="23.4541" transform="matrix(0.994726 -0.102564 0.510633 0.859799 52.4912 -30.7809)" fill="#00BEAE"/>
</G>
<G filter="url(#filter3_f_122_73)">
<Ellipse cx="68.4628" cy="11.5283" rx="68.4628" ry="11.5283" transform="matrix(0.994726 -0.102564 0.510633 0.859799 110.304 -25.8601)" fill="#00FE96"/>
</G>
<Defs>
<Filter id="filter0_f_122_73" x="-97.4081" y="-125.413" width="546.06" height="209.577" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_73"/>
</Filter>
<Filter id="filter1_f_122_73" x="-60.6521" y="-112.982" width="467.376" height="185.247" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_73"/>
</Filter>
<Filter id="filter2_f_122_73" x="9.77842" y="-101.266" width="355.924" height="155.881" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_73"/>
</Filter>
<Filter id="filter3_f_122_73" x="61.8329" y="-89.218" width="244.919" height="132.496" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_73"/>
</Filter>
</Defs>
</Svg>

                        <Text style={styles._______streepjessoorten}>
                            {`€ 1,50`}
                        </Text>
                        <Text style={styles.________streepjessoorten}>
                            {`cat4`}
                        </Text>
                        <Svg style={styles.Group7} width="350" height="50" viewBox="0 0 350 50" fill="none" >
<G filter="url(#filter0_f_122_82)">
<Ellipse cx="221.598" cy="100.81" rx="221.598" ry="100.81" transform="matrix(-0.980962 0.194202 -0.588029 -0.80884 471.316 -4.92124)" fill="#816C00"/>
</G>
<G filter="url(#filter1_f_122_82)">
<Ellipse cx="182.027" cy="75.0393" rx="182.027" ry="75.0393" transform="matrix(-0.980962 0.194202 -0.588029 -0.80884 419.932 -18.5934)" fill="#FCD145"/>
</G>
<G filter="url(#filter2_f_122_82)">
<Ellipse cx="125.748" cy="44.7204" rx="125.748" ry="44.7204" transform="matrix(-0.980962 0.194202 -0.588029 -0.80884 333.153 -26.6607)" fill="#FF00F5"/>
</G>
<G filter="url(#filter3_f_122_82)">
<Ellipse cx="69.4691" cy="21.9812" rx="69.4691" ry="21.9812" transform="matrix(-0.980962 0.194202 -0.588029 -0.80884 268.024 -34.8069)" fill="#3D3D3D"/>
</G>
<Defs>
<Filter id="filter0_f_122_82" x="-84.8151" y="-189.743" width="558.946" height="292.635" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_82"/>
</Filter>
<Filter id="filter1_f_122_82" x="-40.8296" y="-168.288" width="476.151" height="248.7" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_82"/>
</Filter>
<Filter id="filter2_f_122_82" x="3.25047" y="-136.16" width="360.503" height="195.496" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_82"/>
</Filter>
<Filter id="filter3_f_122_82" x="63.478" y="-115.515" width="246.948" height="152.839" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_82"/>
</Filter>
</Defs>
</Svg>

                        <Text style={styles.__________streepjessoorten}>
                            {`€ 1,50`}
                        </Text>
                        <Text style={styles.___________streepjessoorten}>
                            {`cat3`}
                        </Text>
                        <Svg style={styles.Group7} width="350" height="50" viewBox="0 0 350 50" fill="none" >
<G filter="url(#filter0_f_122_91)">
<Ellipse cx="218.388" cy="52.8711" rx="218.388" ry="52.8711" transform="matrix(0.994726 -0.102564 0.510633 0.859799 -68.6118 -43.6849)" fill="#FF0085"/>
</G>
<G filter="url(#filter1_f_122_91)">
<Ellipse cx="179.39" cy="39.3552" rx="179.39" ry="39.3552" transform="matrix(0.994726 -0.102564 0.510633 0.859799 -25.504 -35.797)" fill="#FF00F5"/>
</G>
<G filter="url(#filter2_f_122_91)">
<Ellipse cx="123.926" cy="23.4541" rx="123.926" ry="23.4541" transform="matrix(0.994726 -0.102564 0.510633 0.859799 52.4912 -30.7809)" fill="#00BEAE"/>
</G>
<G filter="url(#filter3_f_122_91)">
<Ellipse cx="68.4628" cy="11.5283" rx="68.4628" ry="11.5283" transform="matrix(0.994726 -0.102564 0.510633 0.859799 110.304 -25.8601)" fill="#FF0085"/>
</G>
<Defs>
<Filter id="filter0_f_122_91" x="-97.4081" y="-125.413" width="546.06" height="209.577" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_91"/>
</Filter>
<Filter id="filter1_f_122_91" x="-60.6521" y="-112.982" width="467.376" height="185.247" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_91"/>
</Filter>
<Filter id="filter2_f_122_91" x="9.77842" y="-101.266" width="355.924" height="155.881" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_91"/>
</Filter>
<Filter id="filter3_f_122_91" x="61.8329" y="-89.218" width="244.919" height="132.496" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<FeGaussianBlur stdDeviation="27.05" result="effect1_foregroundBlur_122_91"/>
</Filter>
</Defs>
</Svg>

                        <Text style={styles._____________streepjessoorten}>
                            {`€ 2,50`}
                        </Text>
                        <Text style={styles.______________streepjessoorten}>
                            {`Speciaal\n`}
                        </Text>
                    <Text style={styles.actieveleden}>
                        {`3 actief`}
                    </Text>
                    <Text style={styles.leden}>
                        {`13 leden`}
                    </Text>
                        <View style={styles.minusbtn}/>
                        <View style={styles.plusbtn}/>
                        <View style={styles.addbtn}/>
                        <Svg style={styles.plusIcon} width="28" height="28" viewBox="0 0 28 28" fill="none" >
<Path d="M12 16H0V12H12V0H16V12H28V16H16V28H12V16Z" fill="#F1F1F1"/>
</Svg>

                        <Svg style={styles.minusIcon} width="21" height="2" viewBox="0 0 21 2" fill="none" >
<Path d="M1 1H19.6667" stroke="#F1F1F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
</Svg>

                        <Text style={styles.addcounter}>
                            {`8`}
                        </Text>
                    <Text style={styles.info}>
                        {`Info`}
                    </Text>
                        <Svg style={styles.Rectangle4} width="45" height="45" viewBox="0 0 45 45" fill="none" >
<Path d="M0 22.5C0 10.0736 10.0736 0 22.5 0C34.9264 0 45 10.0736 45 22.5C45 34.9264 34.9264 45 22.5 45C10.0736 45 0 34.9264 0 22.5Z" fill="#F1F1F1"/>
</Svg>

                        <Text style={styles.lidnaam}>
                            {`Riemer`}
                        </Text>
                        <Svg style={styles.Rectangle4} width="45" height="45" viewBox="0 0 45 45" fill="none" >
<Path d="M0 22.5C0 10.0736 10.0736 0 22.5 0C34.9264 0 45 10.0736 45 22.5C45 34.9264 34.9264 45 22.5 45C10.0736 45 0 34.9264 0 22.5Z" fill="#F1F1F1"/>
</Svg>

                        <Text style={styles._lidnaam}>
                            {`Syme`}
                        </Text>
                        <Svg style={styles.Rectangle4} width="45" height="45" viewBox="0 0 45 45" fill="none" >
<Path d="M0 22.5C0 10.0736 10.0736 0 22.5 0C34.9264 0 45 10.0736 45 22.5C45 34.9264 34.9264 45 22.5 45C10.0736 45 0 34.9264 0 22.5Z" fill="#F1F1F1"/>
</Svg>

                        <Text style={styles.__lidnaam}>
                            {`Hilbren`}
                        </Text>
                        <Svg style={styles.Rectangle4} width="45" height="45" viewBox="0 0 45 45" fill="none" >
<Path d="M0 22.5C0 10.0736 10.0736 0 22.5 0C34.9264 0 45 10.0736 45 22.5C45 34.9264 34.9264 45 22.5 45C10.0736 45 0 34.9264 0 22.5Z" fill="#F1F1F1"/>
</Svg>

                        <Text style={styles.___lidnaam}>
                            {`Ruben`}
                        </Text>
                    <Text style={styles.bekijkmeer}>
                        {`Bekijk meer \/`}
                    </Text>
            </View>
            <View style={styles.frame1}>
                {/* Visualwind:: can be replaced with <NavBar property1={"default"} /> */}
                <View style={styles.navBar}>
                    <View style={styles.settings}/>
                    <View style={styles.home}/>
                    <View style={styles.group}/>
                    <View style={styles.indicator}/>
                    <Svg style={styles.icon} width="57" height="58" viewBox="0 0 57 58" fill="none" >
<G filter="url(#filter0_d_156_11)">
<Path d="M25.3 38.1333H26.3H28.8H30.8M19.8 26.2167L28.05 19.8L36.3 26.2167V36.3C36.3 36.7862 36.1069 37.2525 35.7631 37.5963C35.4193 37.9402 34.9529 38.1333 34.4667 38.1333H21.6334C21.1472 38.1333 20.6808 37.9402 20.337 37.5963C19.9932 37.2525 19.8 36.7862 19.8 36.3V26.2167Z" stroke="#F1F1F1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" shapeRendering="crispEdges"/>
</G>
<Defs>
<Filter id="filter0_d_156_11" x="4.86374e-05" y="-1.23978e-05" width="56.1" height="57.9333" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<FeFlood floodOpacity="0" result="BackgroundImageFix"/>
<FeColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<FeMorphology radius="10" operator="dilate" in="SourceAlpha" result="effect1_dropShadow_156_11"/>
<FeOffset/>
<FeGaussianBlur stdDeviation="4.15"/>
<FeComposite in2="hardAlpha" operator="out"/>
<FeColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.25 0"/>
<FeBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_156_11"/>
<FeBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_156_11" result="shape"/>
</Filter>
</Defs>
</Svg>

                </View>
            </View>
        </View>  )
}

const styles = StyleSheet.create({
    homeContainer: {
        position: "relative",
        flexShrink: 0,
        height: 1530,
        width: 390,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        rowGap: 10,
        padding: 10
    },
    scroll: {
        position: "absolute",
        flexShrink: 0,
        top: 0,
        bottom: 0,
        width: 390,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        rowGap: 0
    },
    _scroll: {
        position: "absolute",
        flexShrink: 0,
        top: 50,
        height: 1124,
        left: 20,
        width: 350
    },
    rectangle2: {
        position: "absolute",
        flexShrink: 0,
        width: 350,
        height: 50,
        overflow: "visible"
    },
    selecteergroep: {
        position: "absolute",
        flexShrink: 0,
        top: 13,
        left: 20,
        width: 189,
        height: 25,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 20,
        fontWeight: 400
    },
    group8: {
        position: "absolute",
        flexShrink: 0,
        top: 63,
        height: 120,
        width: 350
    },
    vector: {
        position: "absolute",
        flexShrink: 0,
        top: -171,
        left: -43,
        width: 438,
        height: 243,
        overflow: "visible"
    },
    rectangle4: {
        position: "absolute",
        flexShrink: 0,
        top: 23,
        left: 20,
        width: 55,
        height: 55,
        overflow: "visible"
    },
    groepnaam: {
        position: "absolute",
        flexShrink: 0,
        top: 30,
        left: 93,
        width: 257,
        height: 40,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 32,
        fontWeight: 400
    },
    streepjessoorten: {
        position: "absolute",
        flexShrink: 0,
        top: 314,
        height: 50,
        width: 350
    },
    group7: {
        position: "absolute",
        flexShrink: 0,
        top: -66,
        height: 106,
        left: -64,
        width: 437
    },
    _streepjessoorten: {
        position: "absolute",
        flexShrink: 0,
        top: 12,
        left: 258,
        width: 71,
        height: 10,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 20,
        fontWeight: 400
    },
    __streepjessoorten: {
        position: "absolute",
        flexShrink: 0,
        top: 10,
        left: 24,
        width: 104,
        height: 10,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 20,
        fontWeight: 400
    },
    drankenlijstbtn: {
        position: "absolute",
        flexShrink: 0,
        top: 613,
        height: 75,
        width: 350
    },
    _group7: {
        position: "absolute",
        flexShrink: 0,
        top: -98,
        height: 123,
        left: -81,
        width: 459
    },
    ___streepjessoorten: {
        position: "absolute",
        flexShrink: 0,
        top: 15,
        left: 20,
        width: 151,
        height: 23,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 20,
        fontWeight: 400
    },
    _drankenlijstbtn: {
        position: "absolute",
        flexShrink: 0,
        top: 1049,
        height: 75,
        width: 350
    },
    __group7: {
        position: "absolute",
        flexShrink: 0,
        top: -109,
        height: 146,
        left: -83,
        width: 459
    },
    ____streepjessoorten: {
        position: "absolute",
        flexShrink: 0,
        top: 15,
        left: 20,
        width: 151,
        height: 23,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 20,
        fontWeight: 400
    },
    ledenlijst: {
        position: "absolute",
        flexShrink: 0,
        top: 704,
        height: 195,
        width: 350
    },
    ___group7: {
        position: "absolute",
        flexShrink: 0,
        top: -100,
        height: 147,
        left: -60,
        width: 440
    },
    _____streepjessoorten: {
        position: "absolute",
        flexShrink: 0,
        top: 19,
        left: 20,
        width: 151,
        height: 23,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 20,
        fontWeight: 400
    },
    ______streepjessoorten: {
        position: "absolute",
        flexShrink: 0,
        top: 491,
        height: 50,
        width: 350
    },
    ____group7: {
        position: "absolute",
        flexShrink: 0,
        top: -66,
        height: 106,
        left: -64,
        width: 437
    },
    _______streepjessoorten: {
        position: "absolute",
        flexShrink: 0,
        top: 15,
        left: 258,
        width: 71,
        height: 10,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 20,
        fontWeight: 400
    },
    ________streepjessoorten: {
        position: "absolute",
        flexShrink: 0,
        top: 10,
        left: 24,
        width: 104,
        height: 10,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 20,
        fontWeight: 400
    },
    _________streepjessoorten: {
        position: "absolute",
        flexShrink: 0,
        top: 432,
        height: 50,
        width: 350
    },
    _____group7: {
        position: "absolute",
        flexShrink: 0,
        top: -162,
        height: 202,
        left: 13,
        width: 443
    },
    __________streepjessoorten: {
        position: "absolute",
        flexShrink: 0,
        top: 15,
        left: 258,
        width: 71,
        height: 10,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 20,
        fontWeight: 400
    },
    ___________streepjessoorten: {
        position: "absolute",
        flexShrink: 0,
        top: 10,
        left: 24,
        width: 104,
        height: 25,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 20,
        fontWeight: 400
    },
    ____________streepjessoorten: {
        position: "absolute",
        flexShrink: 0,
        top: 373,
        height: 50,
        width: 350
    },
    ______group7: {
        position: "absolute",
        flexShrink: 0,
        top: -66,
        height: 106,
        left: -64,
        width: 437
    },
    _____________streepjessoorten: {
        position: "absolute",
        flexShrink: 0,
        top: 15,
        left: 258,
        width: 85,
        height: 10,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 20,
        fontWeight: 400
    },
    ______________streepjessoorten: {
        position: "absolute",
        flexShrink: 0,
        top: 10,
        left: 24,
        width: 104,
        height: 10,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 20,
        fontWeight: 400
    },
    actieveleden: {
        position: "absolute",
        flexShrink: 0,
        top: 158,
        left: 20,
        width: 93,
        height: 25,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 20,
        fontWeight: 400
    },
    leden: {
        position: "absolute",
        flexShrink: 0,
        top: 158,
        left: 235,
        width: 96,
        height: 25,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 20,
        fontWeight: 400
    },
    counter: {
        position: "absolute",
        flexShrink: 0,
        top: 214,
        height: 73,
        width: 350
    },
    minusbtn: {
        position: "absolute",
        flexShrink: 0,
        width: 73,
        height: 73,
        borderStyle: "solid",
        backgroundColor: "rgba(61, 61, 61, 0.01)",
        shadowColor: "rgba(255, 0, 133, 1)",
        shadowOffset: {
                width: 0,
                height: 0
            },
        shadowRadius: 7.400000095367432,
        borderWidth: 1,
        borderColor: "rgba(255, 0, 133, 1)",
        borderRadius: 25
    },
    plusbtn: {
        position: "absolute",
        flexShrink: 0,
        left: 277,
        width: 73,
        height: 73,
        borderStyle: "solid",
        backgroundColor: "rgba(61, 61, 61, 0.01)",
        shadowColor: "rgba(0, 254, 150, 1)",
        shadowOffset: {
                width: 0,
                height: 0
            },
        shadowRadius: 7.400000095367432,
        borderWidth: 1,
        borderColor: "rgba(0, 254, 150, 1)",
        borderRadius: 25
    },
    addbtn: {
        position: "absolute",
        flexShrink: 0,
        left: 138,
        width: 73,
        height: 73,
        borderStyle: "solid",
        backgroundColor: "rgba(61, 61, 61, 0.01)",
        borderWidth: 1,
        borderColor: "rgba(128, 128, 128, 1)",
        borderRadius: 25
    },
    plus_icon: {
        position: "absolute",
        flexShrink: 0,
        top: 22,
        left: 300,
        width: 28,
        height: 28,
        overflow: "visible"
    },
    minus_icon: {
        position: "absolute",
        flexShrink: 0,
        top: 36,
        left: 28,
        width: 19,
        minHeight: 0.001,
        overflow: "visible"
    },
    addcounter: {
        position: "absolute",
        flexShrink: 0,
        top: 16,
        left: 160,
        width: 29,
        height: 41,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 32,
        fontWeight: 600
    },
    info: {
        position: "absolute",
        flexShrink: 0,
        top: 557,
        left: 20,
        width: 74,
        height: 40,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 32,
        fontWeight: 400
    },
    lid: {
        position: "absolute",
        flexShrink: 0,
        top: 764,
        height: 45,
        left: 20,
        width: 318
    },
    _rectangle4: {
        position: "absolute",
        flexShrink: 0,
        width: 45,
        height: 45,
        overflow: "visible"
    },
    lidnaam: {
        position: "absolute",
        flexShrink: 0,
        top: 9,
        left: 61,
        width: 257,
        height: 25,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 20,
        fontWeight: 400
    },
    _lid: {
        position: "absolute",
        flexShrink: 0,
        top: 825,
        height: 45,
        left: 20,
        width: 318
    },
    __rectangle4: {
        position: "absolute",
        flexShrink: 0,
        width: 45,
        height: 45,
        overflow: "visible"
    },
    _lidnaam: {
        position: "absolute",
        flexShrink: 0,
        top: 9,
        left: 61,
        width: 257,
        height: 25,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 20,
        fontWeight: 400
    },
    __lid: {
        position: "absolute",
        flexShrink: 0,
        top: 947,
        height: 45,
        left: 20,
        width: 318
    },
    ___rectangle4: {
        position: "absolute",
        flexShrink: 0,
        width: 45,
        height: 45,
        overflow: "visible"
    },
    __lidnaam: {
        position: "absolute",
        flexShrink: 0,
        top: 9,
        left: 61,
        width: 257,
        height: 25,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 20,
        fontWeight: 400
    },
    ___lid: {
        position: "absolute",
        flexShrink: 0,
        top: 886,
        height: 45,
        left: 20,
        width: 318
    },
    ____rectangle4: {
        position: "absolute",
        flexShrink: 0,
        width: 45,
        height: 45,
        overflow: "visible"
    },
    ___lidnaam: {
        position: "absolute",
        flexShrink: 0,
        top: 9,
        left: 61,
        width: 257,
        height: 25,
        textAlign: "left",
        color: "rgba(255, 255, 255, 1)",
        fontFamily: "Unbounded",
        fontSize: 20,
        fontWeight: 400
    },
    bekijkmeer: {
        position: "absolute",
        flexShrink: 0,
        top: 1012,
        left: 43,
        width: 110,
        height: 17,
        textAlign: "left",
        color: "rgba(132, 132, 132, 1)",
        fontFamily: "Unbounded",
        fontSize: 14,
        fontWeight: 400
    },
    frame1: {
        position: "absolute",
        flexShrink: 0,
        top: 765,
        left: -10,
        width: 410,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        rowGap: 10,
        padding: 10
    },
    navBar: {
        position: "relative",
        alignSelf: "stretch",
        flexShrink: 0,
        height: 77,
        paddingTop: 23,
        paddingBottom: 22,
        paddingLeft: 310,
        paddingRight: 48,
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
        borderBottomRightRadius: 0,
        borderBottomLeftRadius: 0,
        backgroundColor: "rgba(21, 21, 21, 0.5)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        rowGap: 10
    },
    settings: {
        position: "absolute",
        flexShrink: 0,
        top: 23,
        left: 310,
        width: 32,
        height: 32,
        backgroundColor: "rgba(135, 135, 135, 0)"
    },
    home: {
        position: "absolute",
        flexShrink: 0,
        top: 23,
        left: 179,
        width: 32,
        height: 32,
        backgroundColor: "rgba(135, 135, 135, 0)"
    },
    group: {
        position: "absolute",
        flexShrink: 0,
        top: 23,
        left: 48,
        width: 32,
        height: 32,
        backgroundColor: "rgba(135, 135, 135, 0)"
    },
    indicator: {
        position: "absolute",
        flexShrink: 0,
        top: 14,
        left: 155,
        width: 80,
        height: 50,
        backgroundColor: "rgba(255, 0, 133, 0.8)",
        shadowColor: "rgba(255, 0, 133, 1)",
        shadowOffset: {
                width: 0,
                height: 0
            },
        shadowRadius: 9.399999618530273,
        borderRadius: 44
    },
    icon: {
        position: "absolute",
        flexShrink: 0,
        top: 30,
        left: 187,
        width: 17,
        height: 18,
        overflow: "visible"
    }
});